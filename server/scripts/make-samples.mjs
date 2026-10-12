// Generates the sample input files offered on the "Analyze" page.
// Run from the project root:  npm run samples
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAccountPool } from '../src/engine/data.js';
import { PRESETS, generateAttack, makeNormalTx } from '../src/engine/generators.js';
import { analyzeCsv } from '../src/engine/analyze.js';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public/samples');
fs.mkdirSync(outDir, { recursive: true });

// A small pool so each account has enough history in the file for the detector to learn from
const pool = buildAccountPool(40);
const START = Date.parse('2026-10-10T09:00:00+05:30');

const cell = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function build({ legit, attacks = [], labelled }) {
  const rows = [];
  let t = START;
  for (let i = 0; i < legit; i++) {
    t += 4000 + Math.random() * 14000;
    rows.push({ ts: t, ...makeNormalTx(pool), isFraud: false });
  }
  // Attacks land in the second half, after accounts have built up some history
  attacks.forEach(([type, intensity], i) => {
    const base = START + (t - START) * (0.5 + (0.45 * (i + 0.5)) / attacks.length);
    for (const { offsetMs, tx } of generateAttack(type, PRESETS[type][intensity], pool)) rows.push({ ts: base + offsetMs, ...tx });
  });
  rows.sort((a, b) => a.ts - b.ts);

  const cols = ['timestamp', 'accountId', 'amount', 'merchant', 'merchantCategory', 'channel', 'deviceId', 'city', 'txType', 'counterpartyId', 'accountAgeDays'];
  if (labelled) cols.push('isFraud');
  const lines = rows.map((r) =>
    cols
      .map((c) => (c === 'timestamp' ? new Date(r.ts).toISOString() : c === 'isFraud' ? (r.isFraud ? 'true' : 'false') : r[c]))
      .map(cell)
      .join(',')
  );
  return [cols.join(','), ...lines].join('\n') + '\n';
}

const files = {
  'normal-day.csv': build({ legit: 300, labelled: false }),
  'card-testing-attack.csv': build({ legit: 220, attacks: [['card_testing', 'high']], labelled: true }),
  'mixed-attacks.csv': build({
    legit: 480,
    attacks: [
      ['card_testing', 'high'],
      ['account_takeover', 'high'],
      ['velocity_burst', 'high'],
      ['impossible_travel', 'high'],
      ['mule_chain', 'high'],
      ['refund_abuse', 'high'],
      ['account_takeover', 'low'],
      ['card_testing', 'low'],
    ],
    labelled: true,
  }),
};

for (const [name, csv] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, name), csv);
  const { summary } = analyzeCsv(csv);
  console.log(name.padEnd(26), `${summary.rows} rows, ${summary.flagged} flagged`, summary.labelled ? `, labelled fraud caught ${summary.labelled.caught}/${summary.labelled.fraud}, false positives ${summary.labelled.falsePositives}` : '', JSON.stringify(summary.byPattern));
}
