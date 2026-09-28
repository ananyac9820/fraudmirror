import { Router } from 'express';
import AttackRun from '../models/AttackRun.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { engine } from '../engine/engine.js';
import { ATTACK_TYPES, PRESETS } from '../engine/generators.js';

const router = Router();
router.use(requireAuth, requireRole('redteam', 'admin'));

// GET /api/attacks - recent red-team runs + available attack types/presets
router.get('/', async (req, res) => {
  const runs = await AttackRun.find().sort({ startedAt: -1 }).limit(20).lean();
  res.json({ runs, types: ATTACK_TYPES, presets: PRESETS });
});

// POST /api/attacks/launch  { attackType, intensity }
router.post('/launch', async (req, res) => {
  const { attackType, intensity = 'medium' } = req.body || {};
  if (!ATTACK_TYPES.includes(attackType)) return res.status(400).json({ error: `attackType must be one of ${ATTACK_TYPES.join(', ')}` });
  if (!['low', 'medium', 'high'].includes(intensity)) return res.status(400).json({ error: 'intensity must be low, medium or high' });
  const run = await engine.launchAttack(attackType, intensity, req.user);
  res.status(201).json(run);
});

export default router;
