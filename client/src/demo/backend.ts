/**
 * In-browser stand-in for the Express + MongoDB + Socket.io server, used only by the
 * static GitHub Pages build (vite --mode pages). It reuses the server's own simulator,
 * detector and loop modules, and answers the same REST paths the real API serves.
 */
import { buildAccountPool, pick, randInt, weightedPick } from '../../../server/src/engine/data.js';
import { Detector, defaultDetectorConfig } from '../../../server/src/engine/detector.js';
import { ATTACK_TYPES, PRESETS, generateAttack, makeNormalTx } from '../../../server/src/engine/generators.js';
import { AttackDefendLoop } from '../../../server/src/engine/loop.js';
import type { Alert, AttackRun, LoopRound, Role, Tx, User } from '../lib/types';

type Intensity = 'low' | 'medium' | 'high';
type Listener = (event: string, payload: unknown) => void;
interface Queued {
  due: number;
  tx: Record<string, unknown>;
  runId: string | null;
}
interface StoredTx extends Tx {
  attackRunId: string | null;
}
interface StoredAlert extends Alert {
  createdAt: string;
}

export class DemoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TICK_MS = 800;
const MAX_TX = 9000;
const USERS: (User & { password: string })[] = [
  { id: 'u-analyst', name: 'Asha (Analyst)', email: 'analyst@fraudmirror.dev', role: 'analyst', password: 'demo123' },
  { id: 'u-redteam', name: 'Rohan (Red Team)', email: 'redteam@fraudmirror.dev', role: 'redteam', password: 'demo123' },
  { id: 'u-admin', name: 'Admin', email: 'admin@fraudmirror.dev', role: 'admin', password: 'demo123' },
];

let idSeq = 0;
const newId = () => `${Date.now().toString(16)}${(++idSeq).toString(16).padStart(8, '0')}`;

const pool = buildAccountPool();
const detector = new Detector(defaultDetectorConfig());
detector.warm(pool);
const loop = new AttackDefendLoop(pool);

let txs: StoredTx[] = [];
const alerts: StoredAlert[] = [];
const runs: AttackRun[] = [];
const rounds: LoopRound[] = [];
let queue: Queued[] = [];
let started = false;
const listeners = new Set<{ role: Role; fn: Listener }>();

const canSeeTruth = (role: Role) => role === 'redteam' || role === 'admin';
function sanitize(t: StoredTx): Tx {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isFraud, attackType, attackRunId, ...rest } = t;
  return rest;
}

function enqueue(type: string, params: Record<string, unknown>, startTs: number, runId: string | null = null) {
  const items = generateAttack(type, params, pool) as { offsetMs: number; tx: Record<string, unknown> }[];
  for (const { offsetMs, tx } of items) queue.push({ due: startTs + offsetMs, tx, runId });
  queue.sort((a, b) => a.due - b.due);
  return items.length;
}

function buildBatch(now: number): StoredTx[] {
  const raw: Queued[] = [];
  const n = randInt(1, 3);
  for (let i = 0; i < n; i++) raw.push({ due: now, tx: makeNormalTx(pool), runId: null });
  if (Math.random() < 0.012) {
    const type = pick(ATTACK_TYPES) as string;
    const intensity = weightedPick(['low', 'medium', 'high'], [5, 3.5, 1.5]) as Intensity;
    enqueue(type, (PRESETS as Record<string, Record<Intensity, Record<string, unknown>>>)[type][intensity], now);
  }
  while (queue.length && queue[0].due <= now) raw.push(queue.shift()!);
  raw.sort((a, b) => a.due - b.due);
  return raw.map(({ due, tx, runId }) => {
    const ts = Math.min(due, now);
    const doc = {
      ...tx,
      _id: newId(),
      txId: `TX${ts.toString(36).toUpperCase()}${(++idSeq).toString(36).toUpperCase().padStart(4, '0')}`,
      timestamp: new Date(ts).toISOString(),
      attackRunId: runId,
      isFraud: !!tx.isFraud,
      attackType: (tx.attackType as string) || null,
    } as unknown as StoredTx;
    return Object.assign(doc, detector.score(doc));
  });
}

function store(batch: StoredTx[]) {
  txs.push(...batch);
  if (txs.length > MAX_TX) txs = txs.slice(txs.length - MAX_TX);
  const created: StoredAlert[] = batch
    .filter((t) => t.flagged)
    .map((t) => ({
      _id: newId(),
      transactionId: t._id,
      txId: t.txId,
      accountId: t.accountId,
      amount: t.amount,
      merchant: t.merchant,
      timestamp: t.timestamp,
      riskScore: t.riskScore,
      reasons: t.reasons,
      suspectedPattern: t.suspectedPattern || 'unknown',
      status: 'open',
      createdAt: t.timestamp,
    }));
  alerts.push(...created);
  return created;
}

function emit(event: string, payloadFor: (role: Role) => unknown) {
  for (const l of listeners) l.fn(event, payloadFor(l.role));
}

function tick() {
  const batch = buildBatch(Date.now());
  const created = store(batch);
  emit('tx', (role) => (canSeeTruth(role) ? batch : batch.map(sanitize)));
  for (const a of created) emit('alert', () => a);
  const touched = new Set<string>();
  for (const t of batch) {
    if (!t.attackRunId) continue;
    const run = runs.find((r) => r._id === t.attackRunId);
    if (!run) continue;
    run.emitted += 1;
    if (t.flagged) run.detectedCount += 1;
    touched.add(run._id);
  }
  for (const id of touched) {
    const run = runs.find((r) => r._id === id)!;
    emit('attack:update', () => ({ ...run }));
  }
}

function start() {
  if (started) return;
  started = true;
  const end = Date.now();
  for (let ts = end - 30 * 60000; ts < end; ts += TICK_MS) store(buildBatch(ts));
  setInterval(tick, TICK_MS);
}

export function subscribe(token: string, fn: Listener) {
  const user = userFromToken(token);
  start();
  const entry = { role: user.role, fn };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

function userFromToken(token: string | null): User {
  const u = USERS.find((x) => token === `demo.${x.id}`);
  if (!u) throw new DemoError(401, 'Invalid or expired token');
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function requireRole(user: User, ...roles: Role[]) {
  if (!roles.includes(user.role)) throw new DemoError(403, `Requires role: ${roles.join(' or ')}`);
}

function stats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = txs.filter((t) => new Date(t.timestamp) >= startOfDay);
  const k = { total: 0, flagged: 0, fraud: 0, caught: 0, amountProtected: 0, amountSlipped: 0, volume: 0 };
  const buckets = Array(10).fill(0);
  const missed: Record<string, number> = {};
  const caught: Record<string, number> = {};
  for (const t of today) {
    k.total++;
    k.volume += t.amount;
    if (t.flagged) k.flagged++;
    if (t.isFraud) {
      k.fraud++;
      if (t.flagged) {
        k.caught++;
        k.amountProtected += t.amount;
        caught[t.attackType!] = (caught[t.attackType!] || 0) + 1;
      } else {
        k.amountSlipped += t.amount;
        missed[t.attackType!] = (missed[t.attackType!] || 0) + 1;
      }
    }
    buckets[Math.min(9, Math.floor(t.riskScore / 10))]++;
  }
  const since = Date.now() - 30 * 60000;
  const perMinute = new Map<number, { total: number; flagged: number; slipped: number }>();
  for (const t of txs) {
    const ts = new Date(t.timestamp).getTime();
    if (ts < since) continue;
    const m = Math.floor(ts / 60000) * 60000;
    const row = perMinute.get(m) || { total: 0, flagged: 0, slipped: 0 };
    row.total++;
    if (t.flagged) row.flagged++;
    if (t.isFraud && !t.flagged) row.slipped++;
    perMinute.set(m, row);
  }
  const byPattern: Record<string, number> = {};
  for (const a of alerts) if (new Date(a.createdAt) >= startOfDay) byPattern[a.suspectedPattern] = (byPattern[a.suspectedPattern] || 0) + 1;
  return {
    kpis: {
      transactionsToday: k.total,
      flaggedToday: k.flagged,
      openAlerts: alerts.filter((a) => a.status === 'open').length,
      fraudToday: k.fraud,
      caughtToday: k.caught,
      slippedToday: k.fraud - k.caught,
      detectionRate: k.fraud ? k.caught / k.fraud : 0,
      amountProtected: k.amountProtected,
      amountSlipped: k.amountSlipped,
      volumeToday: k.volume,
    },
    perMinute: [...perMinute.entries()].sort((a, b) => a[0] - b[0]).map(([m, v]) => ({ minute: new Date(m).toISOString(), ...v })),
    alertsByPattern: Object.entries(byPattern).map(([pattern, count]) => ({ pattern, count })),
    riskDistribution: buckets.map((count, i) => ({ bucket: i === 9 ? '90–100' : `${i * 10}–${i * 10 + 9}`, count })),
    byAttackType: [...new Set([...Object.keys(missed), ...Object.keys(caught)])].map((type) => ({ type, caught: caught[type] || 0, missed: missed[type] || 0 })),
  };
}

/** Same paths and payloads as the Express API. */
export async function demoRequest(method: string, path: string, body: Record<string, unknown> | undefined, token: string | null): Promise<unknown> {
  const url = new URL(path, 'http://demo.local');
  const p = url.pathname;
  const q = url.searchParams;

  if (method === 'POST' && p === '/auth/login') {
    const u = USERS.find((x) => x.email === String(body?.email || '').toLowerCase().trim() && x.password === body?.password);
    if (!u) throw new DemoError(401, 'Invalid email or password');
    start();
    return { token: `demo.${u.id}`, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
  }

  const user = userFromToken(token);
  start();
  const truth = canSeeTruth(user.role);

  if (method === 'GET' && p === '/auth/me') return { user };

  if (method === 'GET' && p === '/transactions') {
    const limit = Math.min(Number(q.get('limit')) || 100, 500);
    let list = txs;
    if (q.get('flagged') === 'true') list = list.filter((t) => t.flagged);
    if (q.get('accountId')) list = list.filter((t) => t.accountId === q.get('accountId'));
    if (truth && q.get('slipped') === 'true') list = list.filter((t) => t.isFraud && !t.flagged);
    const out = list.slice(-limit).reverse();
    return truth ? out : out.map(sanitize);
  }

  if (method === 'GET' && p === '/stats') return stats();

  if (p.startsWith('/alerts')) {
    requireRole(user, 'analyst', 'admin');
    const id = p.split('/')[2];
    if (method === 'GET' && !id) {
      let list = [...alerts];
      const status = q.get('status');
      const pattern = q.get('pattern');
      if (status && status !== 'all') list = list.filter((a) => a.status === status);
      if (pattern && pattern !== 'all') list = list.filter((a) => a.suspectedPattern === pattern);
      list.sort((a, b) => b.riskScore - a.riskScore || +new Date(b.createdAt) - +new Date(a.createdAt));
      const counts: Record<string, number> = {};
      for (const a of alerts) counts[a.status] = (counts[a.status] || 0) + 1;
      return { alerts: list.slice(0, 300), counts };
    }
    const alert = alerts.find((a) => a._id === id);
    if (!alert) throw new DemoError(404, 'Alert not found');
    const tx = txs.find((t) => t._id === alert.transactionId);
    if (!tx) throw new DemoError(404, 'This transaction has aged out of the in-browser demo');
    if (method === 'GET') {
      const history = txs.filter((t) => t.accountId === alert.accountId && t._id !== tx._id).slice(-10).reverse();
      const reviewed = alert.status !== 'open';
      return {
        alert,
        transaction: reviewed ? tx : sanitize(tx),
        history: history.map(sanitize),
        groundTruth: reviewed ? { isFraud: tx.isFraud, attackType: tx.attackType } : null,
      };
    }
    if (method === 'PATCH' && p.endsWith('/review')) {
      const decision = body?.decision as Alert['status'];
      if (decision !== 'confirmed_fraud' && decision !== 'false_positive') throw new DemoError(400, "decision must be 'confirmed_fraud' or 'false_positive'");
      Object.assign(alert, { status: decision, reviewNote: String(body?.note || '').slice(0, 1000), reviewedByName: user.name, reviewedAt: new Date().toISOString() });
      return { alert, transaction: tx, groundTruth: { isFraud: tx.isFraud, attackType: tx.attackType }, correct: (decision === 'confirmed_fraud') === tx.isFraud };
    }
  }

  if (p.startsWith('/attacks')) {
    requireRole(user, 'redteam', 'admin');
    if (method === 'GET' && p === '/attacks') return { runs: runs.slice(-20).reverse(), types: ATTACK_TYPES, presets: PRESETS };
    if (method === 'POST' && p === '/attacks/launch') {
      const attackType = String(body?.attackType);
      const intensity = String(body?.intensity || 'medium') as Intensity;
      if (!(ATTACK_TYPES as string[]).includes(attackType)) throw new DemoError(400, 'Unknown attack type');
      if (!['low', 'medium', 'high'].includes(intensity)) throw new DemoError(400, 'intensity must be low, medium or high');
      const run: AttackRun = { _id: newId(), attackType, intensity, launchedByName: user.name, startedAt: new Date().toISOString(), count: 0, emitted: 0, detectedCount: 0 };
      runs.push(run);
      run.count = enqueue(attackType, (PRESETS as Record<string, Record<Intensity, Record<string, unknown>>>)[attackType][intensity], Date.now() + 300, run._id);
      emit('attack:update', () => ({ ...run }));
      return { ...run };
    }
  }

  if (p === '/loop/rounds' && method === 'GET') return { rounds, config: loop.config, attackerParams: loop.attackerParams };
  if (p === '/loop/round' && method === 'POST') {
    const round = { _id: newId(), createdAt: new Date().toISOString(), ...loop.runRound() } as LoopRound;
    rounds.push(round);
    return { round, config: loop.config };
  }
  if (p === '/loop/reset' && method === 'POST') {
    rounds.length = 0;
    loop.reset();
    return { ok: true };
  }

  throw new DemoError(404, `No demo route for ${method} ${p}`);
}
