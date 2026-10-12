import mongoose from 'mongoose';

// One uploaded file and the detector's output for it
const analysisSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: String,
    summary: mongoose.Schema.Types.Mixed,
    warnings: [String],
    results: [mongoose.Schema.Types.Mixed],
  },
  { timestamps: true }
);

export default mongoose.model('Analysis', analysisSchema);
