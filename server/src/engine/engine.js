import Transaction from '../models/Transaction.js';
import Alert from '../models/Alert.js';
import AttackRun from '../models/AttackRun.js';
import { buildAccountPool, pick, randInt, weightedPick } from './data.js';
import { Detector, defaultDetectorConfig } from './detector.js';
import { ATTACK_TYPES, PRESETS, generateAttack, makeNormalTx } from './generators.js';

const TICK_MS = 800;
const BACKGROUND_ATTACK_CHANCE = 0.012; // per tick -> roughly 2% of all transactions are fraud
const BACKFILL_MINUTES = 30;

/** Strip ground truth for viewers who must not see it (analysts). */
export function sanitizeTx(tx) {
  const { isFraud, attackType, attackRunId, ...rest } = tx;
  return rest;
}

export const alertFromTx = (t) => ({
  transactionId: t._id,
  txId: t.txId,
  accountId: t.accountId,
  amount: t.amount,
  merchant: t.merchant,
  timestamp: t.timestamp,
  riskScore: t.riskScore,
  reasons: t.reasons,
  suspectedPattern: t.suspectedPattern,
});

class Engine {
  constructor() {
    this.config = defaultDetectorConfig(); // shared with the Loop, which tunes it
    this.pool = buildAccountPool();
    this.detector = new Detector(this.config);
    this.detector.warm(this.pool);
    this.queue = []; // pending attack transactions: { due, tx, runId }
    this.seq = 0;
    this.io = null;
    this.busy = false;
  }

  nextTxId(ts) {
    this.seq += 1;
    return `TX${ts.toString(36).toUpperCase()}${this.seq.toString(36).toUpperCase().padStart(4, '0')}`;
  }

  enqueue(type, params, startTs, runId = null) {
    const items = generateAttack(type, params, this.pool);
    for (const { offsetMs, tx } of items) this.queue.push({ due: startTs + offsetMs, tx, runId });
    this.queue.sort((a, b) => a.due - b.due);
    return items.length;
  }

  /** Produce and score one tick's worth of transactions at time `now`. */
  buildBatch(now) {
    const raw = [];
    const n = randInt(1, 3);
    for (let i = 0; i < n; i++) raw.push({ due: now, tx: makeNormalTx(this.pool), runId: null });

    if (Math.random() < BACKGROUND_ATTACK_CHANCE) {
      const type = pick(ATTACK_TYPES);
      const intensity = weightedPick(['low', 'medium', 'high'], [5, 3.5, 1.5]);
      this.enqueue(type, PRESETS[type][intensity], now);
    }
    while (this.queue.length && this.queue[0].due <= now) raw.push(this.queue.shift());

    raw.sort((a, b) => a.due - b.due);
    return raw.map(({ due, tx, runId }) => {
      const ts = Math.min(due, now);
      const doc = { ...tx, timestamp: new Date(ts), txId: this.nextTxId(ts), attackRunId: runId, isFraud: !!tx.isFraud, attackType: tx.attackType || null };
      return Object.assign(doc, this.detector.score(doc));
    });
  }

  async backfillIfEmpty() {
    if ((await Transaction.estimatedDocumentCount()) > 0) return;
    const end = Date.now();
    const docs = [];
    for (let ts = end - BACKFILL_MINUTES * 60000; ts < end; ts += TICK_MS) docs.push(...this.buildBatch(ts));
    for (let i = 0; i < docs.length; i += 1000) {
      const saved = await Transaction.insertMany(docs.slice(i, i + 1000), { lean: true });
      const alerts = saved.filter((t) => t.flagged).map(alertFromTx);
      if (alerts.length) await Alert.insertMany(alerts);
    }
    console.log(`[seed] Backfilled ${docs.length} synthetic transactions (${BACKFILL_MINUTES} min of history)`);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const docs = this.buildBatch(Date.now());
      const saved = (await Transaction.insertMany(docs)).map((d) => d.toObject());
      const flagged = saved.filter((t) => t.flagged);
      const alerts = flagged.length ? (await Alert.insertMany(flagged.map(alertFromTx))).map((a) => a.toObject()) : [];

      this.io.to('truth').emit('tx', saved);
      this.io.to('analyst').emit('tx', saved.map(sanitizeTx));
      for (const a of alerts) this.io.emit('alert', a);

      // Progress of red-team attack runs
      const byRun = {};
      for (const t of saved) {
        if (!t.attackRunId) continue;
        const k = t.attackRunId.toString();
        byRun[k] = byRun[k] || { emitted: 0, detectedCount: 0 };
        byRun[k].emitted += 1;
        if (t.flagged) byRun[k].detectedCount += 1;
      }
      for (const [id, inc] of Object.entries(byRun)) {
        const run = await AttackRun.findByIdAndUpdate(id, { $inc: inc }, { new: true }).lean();
        if (run) this.io.emit('attack:update', run);
      }
    } catch (e) {
      console.error('[engine] tick failed:', e.message);
    } finally {
      this.busy = false;
    }
  }

  async launchAttack(attackType, intensity, user) {
    const run = await AttackRun.create({ attackType, intensity, launchedBy: user.id, launchedByName: user.name });
    run.count = this.enqueue(attackType, PRESETS[attackType][intensity], Date.now() + 300, run._id);
    await run.save();
    const obj = run.toObject();
    this.io.emit('attack:update', obj);
    return obj;
  }

  async start(io) {
    this.io = io;
    await this.backfillIfEmpty();
    setInterval(() => this.tick(), TICK_MS);
    console.log('[engine] Simulator + detector running (tick every 800 ms)');
  }
}

export const engine = new Engine();
