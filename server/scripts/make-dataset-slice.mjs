// Cuts a 5,000-row excerpt from the public Sparkov credit-card dataset for the "Analyze" page.
//
//   1. Download fraudTest.csv from https://www.kaggle.com/datasets/kartik2112/fraud-detection (CC0)
//   2. npm run dataset -- "C:\path\to\fraudTest.csv"
//
// The excerpt keeps whole stretches of card history (the detector needs earlier payments to judge
// later ones) and deliberately over-represents cards that were defrauded, so it is NOT a random
// sample: fraud is about 0.4% of the full file and several percent of the excerpt.
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { MAX_ROWS, analyzeCsv } from '../src/engine/analyze.js';

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error('Usage: npm run dataset -- <path to fraudTest.csv>');
  process.exit(1);
}
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/public/samples/sparkov-credit-card-slice.csv');

const FRAUD_CARDS = 30;
const CLEAN_CARDS = 14;
const DAY = 86400;

function split(line) {
  const cells = [];
  let field = '';
  let quoted = false;
  for (const c of line) {
    if (quoted) {
      if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      cells.push(field);
      field = '';
    } else field += c;
  }
  cells.push(field);
  return cells;
}

async function eachRow(fn) {
  let header = null;
  for await (const line of readline.createInterface({ input: fs.createReadStream(source) })) {
    if (!header) {
      header = split(line);
      continue;
    }
    const cells = split(line);
    fn(Object.fromEntries(header.map((h, i) => [h, cells[i]])));
  }
}

// Pass 1: when was each card defrauded?
const cards = new Map();
await eachRow((r) => {
  let c = cards.get(r.cc_num);
  if (!c) cards.set(r.cc_num, (c = { rows: 0, fraudFirst: null, fraudLast: null, first: +r.unix_time }));
  c.rows += 1;
  if (r.is_fraud === '1') {
    c.fraudFirst ??= +r.unix_time;
    c.fraudLast = +r.unix_time;
  }
});

// Deterministic choice (sorted by card number, evenly spaced) so the excerpt is reproducible
const sorted = [...cards.entries()].sort((a, b) => a[0].localeCompare(b[0]));
const spaced = (list, n) => list.filter((_, i) => i % Math.max(1, Math.floor(list.length / n)) === 0).slice(0, n);
const fraudCards = spaced(sorted.filter(([, c]) => c.fraudFirst && c.fraudFirst - c.first > 40 * DAY), FRAUD_CARDS);
const cleanCards = spaced(sorted.filter(([, c]) => !c.fraudFirst), CLEAN_CARDS);

// Shrink the history window until the excerpt fits the upload limit
let rows = [];
for (let daysBefore = 30; daysBefore >= 5; daysBefore -= 1) {
  const windows = new Map();
  for (const [cc, c] of fraudCards) windows.set(cc, [c.fraudFirst - daysBefore * DAY, c.fraudLast + 3 * DAY]);
  for (const [cc, c] of cleanCards) windows.set(cc, [c.first + 30 * DAY, c.first + (33 + daysBefore) * DAY]);
  rows = [];
  await eachRow((r) => {
    const w = windows.get(r.cc_num);
    if (w && +r.unix_time >= w[0] && +r.unix_time <= w[1]) rows.push(r);
  });
  if (rows.length <= MAX_ROWS) break;
}

// Keep only the columns the detector uses. The persona columns (names, street, date of birth, job)
// are synthetic but are left out anyway, and card numbers are cut to their last 8 digits.
const cols = ['trans_date_trans_time', 'cc_num', 'merchant', 'category', 'amt', 'city', 'state', 'is_fraud'];
const cell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(c === 'cc_num' ? r.cc_num.slice(-8) : r[c])).join(','))].join('\n') + '\n';
fs.writeFileSync(out, csv);

const { summary } = analyzeCsv(csv);
console.log(`Wrote ${rows.length} rows from ${fraudCards.length} defrauded and ${cleanCards.length} clean cards to ${out}`);
console.log(`Detector on this excerpt: ${summary.flagged} flagged, caught ${summary.labelled.caught} of ${summary.labelled.fraud} fraud rows, ${summary.labelled.falsePositives} false positives`);
