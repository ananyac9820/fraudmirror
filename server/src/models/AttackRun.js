import mongoose from 'mongoose';

const attackRunSchema = new mongoose.Schema({
  attackType: { type: String, required: true },
  intensity: { type: String, enum: ['low', 'medium', 'high'], required: true },
  launchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  launchedByName: String,
  startedAt: { type: Date, default: Date.now },
  count: { type: Number, default: 0 },
  emitted: { type: Number, default: 0 },
  detectedCount: { type: Number, default: 0 },
});

export default mongoose.model('AttackRun', attackRunSchema);
