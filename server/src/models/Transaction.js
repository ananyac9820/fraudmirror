import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  txId: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true },
  accountId: { type: String, required: true, index: true },
  accountAgeDays: Number,
  merchant: String,
  merchantCategory: String,
  txType: { type: String, enum: ['payment', 'refund', 'transfer'], default: 'payment' },
  counterpartyId: { type: String, default: null },
  amount: Number, // INR
  channel: { type: String, enum: ['card', 'upi', 'netbanking'] },
  deviceId: String,
  city: String,
  // Ground truth - hidden from the analyst UI until reviewed
  isFraud: { type: Boolean, default: false },
  attackType: { type: String, default: null },
  attackRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttackRun', default: null },
  // Detector output
  riskScore: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false, index: true },
  reasons: [String],
  suspectedPattern: { type: String, default: null },
});

// The simulator never stops, so a persistent database would grow without bound.
// MongoDB removes stream data after 24 hours.
transactionSchema.index({ timestamp: 1 }, { expireAfterSeconds: 24 * 3600 });

export default mongoose.model('Transaction', transactionSchema);
