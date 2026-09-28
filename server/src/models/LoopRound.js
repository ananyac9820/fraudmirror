import mongoose from 'mongoose';

const loopRoundSchema = new mongoose.Schema(
  {
    generation: { type: Number, required: true },
    attacksGenerated: Number,
    detected: Number,
    detectionRate: Number,
    perType: mongoose.Schema.Types.Mixed, // { card_testing: { generated, detected, rate } }
    mutatedParams: mongoose.Schema.Types.Mixed, // { attacker: [...], defender: [...] }
  },
  { timestamps: true }
);

export default mongoose.model('LoopRound', loopRoundSchema);
