import { Router } from 'express';
import Transaction from '../models/Transaction.js';
import { canSeeTruth, requireAuth } from '../middleware/auth.js';
import { sanitizeTx } from '../engine/engine.js';

const router = Router();

// GET /api/transactions?limit=100&flagged=true&accountId=ACC123456&slipped=true
router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const q = {};
  if (req.query.flagged === 'true') q.flagged = true;
  if (req.query.accountId) q.accountId = String(req.query.accountId);
  const truth = canSeeTruth(req.user);
  if (truth && req.query.slipped === 'true') Object.assign(q, { isFraud: true, flagged: false });
  const txs = await Transaction.find(q).sort({ timestamp: -1 }).limit(limit).lean();
  res.json(truth ? txs : txs.map(sanitizeTx));
});

export default router;
