import fs from 'fs/promises';
import mongoose from 'mongoose';
import Transcript from '../models/Transcript.js';
import { transcribeAudio } from '../services/transcribeService.js';
import { diarizeAudio } from '../services/diarizeService.js';

/**
 * Upload and transcribe an audio file with optional speaker diarization,
 * persist transcript to MongoDB, and clean up temporary uploaded file.
 * POST /api/transcripts
 */
export const transcribe = async (req, res, next) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: 'No audio file uploaded. Please provide an audio file with the field name "audio".',
    });
  }

  // Check if caller requested speaker detection
  const shouldDetectSpeakers =
    req.body?.detectSpeakers === 'true' || req.body?.detectSpeakers === true;
  const targetLanguage = req.body?.language || 'hi';

  try {
    let result;
    let segments;
    let speakerCount;

    if (shouldDetectSpeakers) {
      // Step 6: Use AssemblyAI for speaker diarization
      result = await diarizeAudio(file.path, targetLanguage);
      segments = result.segments || [];
      const uniqueSpeakers = new Set(segments.map((s) => s.speaker));
      speakerCount = uniqueSpeakers.size || 1;
    } else {
      // Default: Use Groq Whisper Large v3
      result = await transcribeAudio(file.path);
    }

    // Persist transcript record in MongoDB
    const newTranscript = await Transcript.create({
      text: result.text,
      originalFileName: file.originalname,
      fileSize: file.size,
      language: result.language,
      duration: result.duration,
      segments: segments && segments.length > 0 ? segments : undefined,
      speakerCount: speakerCount !== undefined ? speakerCount : undefined,
    });

    return res.status(201).json({
      message: shouldDetectSpeakers
        ? 'Audio transcribed with speaker detection and saved successfully'
        : 'Audio transcribed and saved successfully',
      data: newTranscript,
    });
  } catch (error) {
    next(error);
  } finally {
    // Always remove the temporary uploaded file from the server disk
    if (file?.path) {
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        console.error(`Failed to clean up temp file ${file.path}:`, cleanupError.message);
      }
    }
  }
};

/**
 * Retrieve transcripts with search and pagination support.
 * Query params:
 *   - search: string (matches text or originalFileName case-insensitively)
 *   - page: number (default 1)
 *   - limit: number (default 10)
 * GET /api/transcripts
 */
export const getAllTranscripts = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const query = {};

    // Case-insensitive search on text and originalFileName
    if (search && search.trim() !== '') {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitizedSearch, 'i');
      query.$or = [
        { text: searchRegex },
        { originalFileName: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated results and total document count concurrently
    const [transcripts, total] = await Promise.all([
      Transcript.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Transcript.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      transcripts,
      total,
      page: pageNum,
      totalPages,
      count: transcripts.length,
      data: transcripts, // Backwards compatibility
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve a single transcript by its MongoDB ID.
 * GET /api/transcripts/:id
 */
export const getTranscriptById = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transcript ID format' });
  }

  try {
    const transcript = await Transcript.findById(id);

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    return res.status(200).json({ data: transcript });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a transcript by its MongoDB ID.
 * DELETE /api/transcripts/:id
 */
export const deleteTranscript = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transcript ID format' });
  }

  try {
    const deletedTranscript = await Transcript.findByIdAndDelete(id);

    if (!deletedTranscript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    return res.status(200).json({
      message: 'Transcript deleted successfully',
      id: deletedTranscript._id,
    });
  } catch (error) {
    next(error);
  }
};
