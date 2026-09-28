import { Router } from 'express';
import mongoose from 'mongoose';
import Alert from '../models/Alert.js';
import Transaction from '../models/Transaction.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sanitizeTx } from '../engine/engine.js';
import { engine } from '../engine/engine.js';

const router = Router();
router.use(requireAuth, requireRole('analyst', 'admin'));

// GET /api/alerts?status=open&pattern=card_testing
router.get('/', async (req, res) => {
  const q = {};
  if (req.query.status && req.query.status !== 'all') q.status = String(req.query.status);
  if (req.query.pattern && req.query.pattern !== 'all') q.suspectedPattern = String(req.query.pattern);
  const alerts = await Alert.find(q).sort({ riskScore: -1, createdAt: -1 }).limit(300).lean();
  const counts = await Alert.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  res.json({ alerts, counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) });
});

// GET /api/alerts/:id - case file: alert, transaction, account history
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid alert id' });
  const alert = await Alert.findById(req.params.id).lean();
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  const tx = await Transaction.findById(alert.transactionId).lean();
  const history = await Transaction.find({ accountId: alert.accountId, _id: { $ne: alert.transactionId } })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();
  const reviewed = alert.status !== 'open';
  res.json({
    alert,
    transaction: reviewed ? tx : sanitizeTx(tx),
    history: history.map(sanitizeTx),
    groundTruth: reviewed ? { isFraud: tx.isFraud, attackType: tx.attackType } : null,
  });
});

// PATCH /api/alerts/:id/review  { decision: 'confirmed_fraud' | 'false_positive', note }
router.patch('/:id/review', async (req, res) => {
  const { decision, note = '' } = req.body || {};
  if (!['confirmed_fraud', 'false_positive'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'confirmed_fraud' or 'false_positive'" });
  }
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid alert id' });
  const alert = await Alert.findByIdAndUpdate(
    req.params.id,
    { status: decision, reviewNote: String(note).slice(0, 1000), reviewedBy: req.user.id, reviewedByName: req.user.name, reviewedAt: new Date() },
    { new: true }
  ).lean();
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  const tx = await Transaction.findById(alert.transactionId).lean();
  const correct = (decision === 'confirmed_fraud') === tx.isFraud;
  engine.io?.emit('alert:reviewed', { id: alert._id, status: alert.status });
  res.json({ alert, transaction: tx, groundTruth: { isFraud: tx.isFraud, attackType: tx.attackType }, correct });
});

export default router;
