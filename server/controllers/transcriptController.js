import fs from 'fs/promises';
import mongoose from 'mongoose';
import Transcript from '../models/Transcript.js';
import { transcribeAudio } from '../services/transcribeService.js';
import { diarizeAudio } from '../services/diarizeService.js';
import { translateTexts } from '../services/translateService.js';

/**
 * Upload and transcribe an audio file with optional speaker diarization,
 * associate with authenticated user, persist transcript to MongoDB,
 * and clean up temporary uploaded file.
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

  // Validate language against allow-list, default to 'auto'
  const ALLOWED_LANGUAGES = ['auto', 'en', 'hi'];
  const rawLanguage = typeof req.body?.language === 'string' ? req.body.language.trim().toLowerCase() : '';
  const targetLanguage = ALLOWED_LANGUAGES.includes(rawLanguage) ? rawLanguage : 'auto';

  try {
    let result;
    let segments;
    let speakerCount;

    if (shouldDetectSpeakers) {
      // Step 6: Use AssemblyAI for speaker diarization with language selection/detection
      result = await diarizeAudio(file.path, targetLanguage);
      segments = result.segments || [];
      const uniqueSpeakers = new Set(segments.map((s) => s.speaker));
      speakerCount = uniqueSpeakers.size || 1;
    } else {
      // Default: Use Groq Whisper Large v3
      result = await transcribeAudio(file.path);
    }

    // Persist transcript record in MongoDB associated with logged-in user (Step 7)
    const newTranscript = await Transcript.create({
      user: req.user._id,
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
    const errorMsg = error.message || '';
    const lowerMsg = errorMsg.toLowerCase();
    if (
      error.statusCode === 400 ||
      lowerMsg.includes('confidence') ||
      (lowerMsg.includes('detect') && lowerMsg.includes('language')) ||
      lowerMsg.includes('select a language manually') ||
      lowerMsg.includes('choose a language manually') ||
      lowerMsg.includes('pick a language manually')
    ) {
      return res.status(400).json({
        error: error.message || 'Automatic language detection failed or confidence was too low. Please pick a language manually and try again.',
      });
    }
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
 * Retrieve transcripts belonging to logged-in user with search and pagination.
 * Query params:
 *   - search: string (matches text or originalFileName case-insensitively)
 *   - page: number (default 1)
 *   - limit: number (default 10)
 * GET /api/transcripts
 */
export const getAllTranscripts = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    // Scope query strictly to authenticated user
    const query = { user: req.user._id };

    // Case-insensitive search on text and originalFileName inside user's own items
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
 * Retrieve a single transcript by its MongoDB ID (only if owned by current user).
 * Returns 404 for someone else's transcript.
 * GET /api/transcripts/:id
 */
export const getTranscriptById = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transcript ID format' });
  }

  try {
    // Only return if it belongs to logged-in user
    const transcript = await Transcript.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    return res.status(200).json({ data: transcript });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a transcript by its MongoDB ID (only if owned by current user).
 * Returns 404 for someone else's transcript.
 * DELETE /api/transcripts/:id
 */
export const deleteTranscript = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transcript ID format' });
  }

  try {
    // Only delete if it belongs to logged-in user
    const deletedTranscript = await Transcript.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

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

/**
 * Translate a transcript to target language ('en' or 'hi') using Groq Chat Completions.
 * Caches results in MongoDB so subsequent requests are instantaneous.
 * POST /api/transcripts/:id/translate
 */
export const translateTranscript = async (req, res, next) => {
  const { id } = req.params;
  const { target } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transcript ID format' });
  }

  // Validate target language against allow-list
  const ALLOWED_TARGETS = ['en', 'hi'];
  if (!target || !ALLOWED_TARGETS.includes(String(target).toLowerCase().trim())) {
    return res.status(400).json({
      error: 'Invalid target language. Supported target languages are "en" (English) and "hi" (Hindi).',
    });
  }

  const targetLang = String(target).toLowerCase().trim();

  try {
    // Only allow owner to translate
    const transcript = await Transcript.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Check if target is the same as the transcript's detected language
    const normLang = (transcript.language || '').toLowerCase().trim();
    const isAudioEnglish =
      normLang === 'en' ||
      normLang.startsWith('en_') ||
      normLang.startsWith('en-') ||
      normLang === 'english';
    const isAudioHindi =
      normLang === 'hi' ||
      normLang.startsWith('hi_') ||
      normLang.startsWith('hi-') ||
      normLang === 'hindi';

    if ((targetLang === 'en' && isAudioEnglish) || (targetLang === 'hi' && isAudioHindi)) {
      return res.status(400).json({
        error: `Transcript is already in ${targetLang === 'en' ? 'English' : 'Hindi'}. Translation is not needed.`,
      });
    }

    // If a cached translation exists, return it immediately without calling Groq
    if (transcript.translations && transcript.translations[targetLang]?.text) {
      return res.status(200).json({
        message: 'Translation retrieved from cache',
        data: transcript,
        translation: transcript.translations[targetLang],
      });
    }

    let fullText = '';
    let translatedSegments = [];

    // If transcript has segments, translate segment texts so bubble alignment is preserved
    if (Array.isArray(transcript.segments) && transcript.segments.length > 0) {
      const segmentTexts = transcript.segments.map((seg) => seg.text || '');
      translatedSegments = await translateTexts(segmentTexts, targetLang);
      fullText = translatedSegments.join('\n\n');
    } else {
      // Otherwise translate the full single text
      const results = await translateTexts([transcript.text], targetLang);
      fullText = results[0] || '';
      translatedSegments = [];
    }

    // Cache the translation inside transcript
    if (!transcript.translations) {
      transcript.translations = {};
    }

    transcript.translations[targetLang] = {
      text: fullText,
      segments: translatedSegments,
      generatedAt: new Date(),
    };

    // Mark modified since translations is a sub-document
    transcript.markModified('translations');
    await transcript.save();

    return res.status(200).json({
      message: `Transcript translated to ${targetLang === 'en' ? 'English' : 'Hindi'} successfully`,
      data: transcript,
      translation: transcript.translations[targetLang],
    });
  } catch (error) {
    const statusCode = error.statusCode || error.status || 500;
    return res.status(statusCode).json({
      error: error.message || 'Translation failed. Please try again.',
    });
  }
};
