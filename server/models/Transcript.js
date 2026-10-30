import mongoose from 'mongoose';

/**
 * Mongoose Schema for audio transcripts.
 * Stores transcription text, metadata, and creation timestamp.
 */
const transcriptSchema = new mongoose.Schema(
  {
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

