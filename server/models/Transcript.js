import mongoose from 'mongoose';

/**
 * Mongoose Schema for audio transcripts.
 * Stores transcription text, metadata, speaker segments, owner user ID, and timestamp.
 */
const transcriptSchema = new mongoose.Schema(
  {
    // Owner User reference (Step 7)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Transcript must belong to a user'],
      index: true,
    },
    text: {
      type: String,
      required: [true, 'Transcription text is required'],
      trim: true,
    },
    originalFileName: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number, // File size in bytes
    },
    language: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number, // Duration in seconds
      required: false,
    },
    // Optional speaker diarization segments (Step 6)
    segments: [
      {
        speaker: { type: Number, required: true },
        text: { type: String, required: true, trim: true },
        start: { type: Number, required: true },
        end: { type: Number, required: true },
        _id: false,
      },
    ],
    // Optional total unique speakers detected
    speakerCount: {
      type: Number,
      required: false,
    },
    // Optional translations in English and Hindi (Step 9)
    translations: {
      en: {
        text: { type: String, trim: true },
        segments: [{ type: String, trim: true }],
        generatedAt: { type: Date },
        _id: false,
      },
      hi: {
        text: { type: String, trim: true },
        segments: [{ type: String, trim: true }],
        generatedAt: { type: Date },
        _id: false,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

const Transcript = mongoose.model('Transcript', transcriptSchema);

export default Transcript;
