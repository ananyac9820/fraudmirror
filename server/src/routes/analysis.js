import { Router } from 'express';
import mongoose from 'mongoose';
import Analysis from '../models/Analysis.js';
import { requireAuth } from '../middleware/auth.js';
import { analyzeCsv, resultsToCsv } from '../engine/analyze.js';

const router = Router();
router.use(requireAuth);

// GET /api/analysis - saved analyses, newest first (without the row-level results)
router.get('/', async (req, res) => {
  const list = await Analysis.find().select('-results').sort({ createdAt: -1 }).limit(20).lean();
  res.json(list);
});

// POST /api/analysis  { name, csv } - score an uploaded CSV and save the output
router.post('/', async (req, res) => {
  const { name, csv } = req.body || {};
  if (typeof csv !== 'string' || !csv.trim()) return res.status(400).json({ error: 'Send the file contents as "csv".' });
  let output;
  try {
    output = analyzeCsv(csv);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
  const doc = await Analysis.create({
    name: String(name || 'Untitled upload').slice(0, 120),
    uploadedBy: req.user.id,
    uploadedByName: req.user.name,
    ...output,
  });
  res.status(201).json(doc.toObject());
});

const load = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid analysis id' });
    return null;
  }
  const doc = await Analysis.findById(req.params.id).lean();
  if (!doc) res.status(404).json({ error: 'Analysis not found' });
  return doc;
};

// GET /api/analysis/:id - full output
router.get('/:id', async (req, res) => {
  const doc = await load(req, res);
  if (doc) res.json(doc);
});

// GET /api/analysis/:id/export - the output as a CSV file
router.get('/:id/export', async (req, res) => {
  const doc = await load(req, res);
  if (!doc) return;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fraudmirror-results-${doc._id}.csv"`);
  res.send(resultsToCsv(doc.results));
});

export default router;
