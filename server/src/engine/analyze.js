import { Detector, fileAnalysisConfig } from './detector.js';

/**
 * Custom input -> output: score a user-supplied CSV of transactions.
 * Pure JavaScript with no Node dependencies, so the static demo build can reuse it.
 */

export const MAX_ROWS = 5000;
export const USD_TO_INR = 83; // fixed rate used when a file has amounts in US dollars

// Accepted header spellings (compared lower-case, without spaces, dashes or underscores)
const COLUMNS = {
  timestamp: ['timestamp', 'time', 'datetime', 'date', 'transdatetranstime'],
  accountId: ['accountid', 'account', 'ccnum'],
  amount: ['amount', 'amountinr', 'value', 'amt'],
  merchant: ['merchant', 'merchantname'],
  merchantCategory: ['merchantcategory', 'category'],
  channel: ['channel', 'method'],
  deviceId: ['deviceid', 'device'],
  city: ['city', 'location'],
  txType: ['txtype', 'type'],
  counterpartyId: ['counterpartyid', 'counterparty', 'to'],
  accountAgeDays: ['accountagedays', 'accountage'],
  label: ['isfraud', 'fraud', 'label'],
};
export const REQUIRED_COLUMNS = ['timestamp', 'accountId', 'amount'];
export const OPTIONAL_COLUMNS = ['merchant', 'merchantCategory', 'channel', 'deviceId', 'city', 'txType', 'counterpartyId', 'accountAgeDays', 'isFraud'];

function fail(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF or LF, optional BOM. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (h) => h.toLowerCase().replace(/[\s_-]/g, '');
/**
 * Timestamps without a time zone are read as wall-clock time and kept that way (stored as UTC),
 * so "23:15" in the file is 23:15 for the detector on any server and in any browser.
 */
export function parseTimestamp(raw) {
  const v = String(raw).trim();
  const hasZone = /([zZ]|[+-]\d\d:?\d\d)$/.test(v);
  const naive = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(v);
  return new Date(!hasZone && naive ? `${v.replace(' ', 'T')}Z` : v);
}

const truthy = (v) => ['1', 'true', 'yes', 'y', 'fraud'].includes(String(v).trim().toLowerCase());

/**
 * @param csvText raw CSV with a header row
 * @returns {{ results: object[], summary: object, warnings: string[] }}
 */
export function analyzeCsv(csvText) {
  const table = parseCsv(csvText);
  if (table.length < 2) throw fail('The file needs a header row and at least one transaction row.');

  const header = table[0].map(norm);
  const col = {};
  for (const [key, names] of Object.entries(COLUMNS)) col[key] = header.findIndex((h) => names.includes(h));
  const missing = REQUIRED_COLUMNS.filter((k) => col[k] < 0);
  if (missing.length) throw fail(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Found: ${table[0].join(', ')}`);
  if (table.length - 1 > MAX_ROWS) throw fail(`The file has ${table.length - 1} rows. The limit is ${MAX_ROWS}.`);

  // The public Sparkov credit-card dataset (Kaggle: kartik2112/fraud-detection) is accepted as-is:
  // card number -> masked account id, US dollars -> rupees, "fraud_" prefix dropped from merchant names.
  const sparkov = header.includes('ccnum') && header.includes('amt') && header.includes('transdatetranstime');

  const warnings = [];
  const warn = (m) => warnings.length < 10 && warnings.push(m);
  const get = (r, key) => (col[key] >= 0 ? (r[col[key]] ?? '').trim() : '');
  const hasLabels = col.label >= 0;

  const txs = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const line = i + 1;
    const ts = parseTimestamp(get(r, 'timestamp'));
    let amount = Number(get(r, 'amount').replace(/[₹$,\s]/g, ''));
    let accountId = get(r, 'accountId');
    if (sparkov) {
      amount = Math.round(amount * USD_TO_INR);
      if (accountId) accountId = `CARD-${accountId.slice(-8)}`; // never keep a full card number
    }
    if (Number.isNaN(ts.getTime())) {
      warn(`Row ${line} skipped: cannot read timestamp "${get(r, 'timestamp')}"`);
      continue;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      warn(`Row ${line} skipped: amount "${get(r, 'amount')}" is not a positive number`);
      continue;
    }
    if (!accountId) {
      warn(`Row ${line} skipped: accountId is empty`);
      continue;
    }
    const txType = get(r, 'txType').toLowerCase();
    const channel = get(r, 'channel').toLowerCase();
    const age = get(r, 'accountAgeDays');
    txs.push({
      row: line,
      timestamp: ts.toISOString(),
      accountId,
      amount,
      merchant: (sparkov ? get(r, 'merchant').replace(/^fraud_/, '') : get(r, 'merchant')) || 'Unknown merchant',
      merchantCategory: get(r, 'merchantCategory') || '',
      channel: ['card', 'upi', 'netbanking'].includes(channel) ? channel : 'card',
      deviceId: get(r, 'deviceId') || 'unknown-device',
      city: get(r, 'city') || 'Unknown',
      txType: ['payment', 'refund', 'transfer'].includes(txType) ? txType : 'payment',
      counterpartyId: get(r, 'counterpartyId') || null,
      accountAgeDays: age !== '' && Number.isFinite(Number(age)) ? Number(age) : null,
      label: hasLabels ? truthy(get(r, 'label')) : null,
    });
  }
  if (!txs.length) throw fail(`No usable rows. ${warnings[0] || ''}`);

  // The detector's rules depend on order, so score in time order
  txs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp) || a.row - b.row);
  const detector = new Detector(fileAnalysisConfig(), { coldStart: true });
  const results = txs.map((tx) => ({ ...tx, ...detector.score(tx) }));

  const flagged = results.filter((r) => r.flagged);
  const byPattern = {};
  for (const r of flagged) byPattern[r.suspectedPattern] = (byPattern[r.suspectedPattern] || 0) + 1;
  const sum = (list) => Math.round(list.reduce((s, r) => s + r.amount, 0));
  const labelledFraud = results.filter((r) => r.label === true);

  return {
    results,
    warnings,
    summary: {
      format: sparkov ? 'sparkov' : 'fraudmirror',
      amountsConvertedFromUsd: sparkov ? USD_TO_INR : null,
      rows: results.length,
      skipped: table.length - 1 - results.length,
      accounts: new Set(results.map((r) => r.accountId)).size,
      from: results[0].timestamp,
      to: results[results.length - 1].timestamp,
      totalAmount: sum(results),
      flagged: flagged.length,
      flaggedAmount: sum(flagged),
      highestRisk: Math.max(...results.map((r) => r.riskScore)),
      byPattern,
      labelled: hasLabels
        ? {
            fraud: labelledFraud.length,
            caught: labelledFraud.filter((r) => r.flagged).length,
            falsePositives: flagged.filter((r) => r.label === false).length,
          }
        : null,
    },
  };
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The output file: every input row plus the detector's verdict. */
export function resultsToCsv(results) {
  const head = ['row', 'timestamp', 'accountId', 'merchant', 'city', 'channel', 'txType', 'amount', 'riskScore', 'flagged', 'suspectedPattern', 'reasons'];
  const lines = results.map((r) =>
    [r.row, r.timestamp, r.accountId, r.merchant, r.city, r.channel, r.txType, r.amount, r.riskScore, r.flagged ? 'yes' : 'no', r.suspectedPattern || '', r.reasons.join(' | ')]
      .map(csvCell)
      .join(',')
  );
  return [head.join(','), ...lines].join('\r\n');
}
