import mongoose from 'mongoose';

/**
 * GlobalUsage Schema
 * Tracks global daily consumption across all users (e.g. AssemblyAI diarization cap)
 * to safeguard external API credits. Automatically cleans up via 7-day TTL index.
 */
const globalUsageSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Format: "YYYY-MM-DD" in UTC
      required: true,
      unique: true,
    },
    diarizations: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // ~7 days TTL
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically purge expired documents
globalUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const GlobalUsage = mongoose.model('GlobalUsage', globalUsageSchema);

export default GlobalUsage;

