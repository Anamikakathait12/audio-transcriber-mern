import mongoose from 'mongoose';

/**
 * Usage Schema
 * Tracks per-user daily consumption for transcriptions, speaker diarizations, and translations.
 * Automatically cleans up documents older than 7 days via TTL index.
 */
const usageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // Format: "YYYY-MM-DD" in UTC
      required: true,
    },
    transcriptions: {
      type: Number,
      default: 0,
      min: 0,
    },
    diarizations: {
      type: Number,
      default: 0,
      min: 0,
    },
    translations: {
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

// Compound unique index ensuring one usage record per user per UTC date
usageSchema.index({ user: 1, date: 1 }, { unique: true });

// TTL index to automatically purge expired usage documents
usageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Usage = mongoose.model('Usage', usageSchema);

export default Usage;

