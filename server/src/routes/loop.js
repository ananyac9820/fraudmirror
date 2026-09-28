import { Router } from 'express';
import LoopRound from '../models/LoopRound.js';
import { requireAuth } from '../middleware/auth.js';
import { engine } from '../engine/engine.js';
import { AttackDefendLoop } from '../engine/loop.js';

const router = Router();
router.use(requireAuth);

const loop = new AttackDefendLoop(engine.pool);

// GET /api/loop/rounds - all rounds so far + the current candidate detector config
router.get('/rounds', async (req, res) => {
  const rounds = await LoopRound.find().sort({ generation: 1 }).lean();
  res.json({ rounds, config: loop.config, attackerParams: loop.attackerParams });
});

// POST /api/loop/round - run the next attack-and-defend generation
router.post('/round', async (req, res) => {
  const last = await LoopRound.findOne().sort({ generation: -1 }).lean();
  if (last && loop.generation === 0) loop.generation = last.generation; // survive a server restart with a persistent DB
  const round = await LoopRound.create(loop.runRound());
  res.status(201).json({ round: round.toObject(), config: loop.config, attackerParams: loop.attackerParams });
});

// POST /api/loop/reset - start the loop over from generation 1
router.post('/reset', async (req, res) => {
  await LoopRound.deleteMany({});
  loop.reset();
  res.json({ ok: true, config: loop.config });
});

export default router;
