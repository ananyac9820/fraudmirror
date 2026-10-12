import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    txId: String,
    accountId: String,
    amount: Number,
    merchant: String,
    timestamp: Date,
    riskScore: Number,
    reasons: [String],
    suspectedPattern: String,
    status: { type: String, enum: ['open', 'confirmed_fraud', 'false_positive'], default: 'open', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: String,
    reviewNote: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

alertSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 3600 }); // same lifetime as its transaction

export default mongoose.model('Alert', alertSchema);
