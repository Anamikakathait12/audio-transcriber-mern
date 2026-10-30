import fs from 'fs/promises';
import mongoose from 'mongoose';
import Transcript from '../models/Transcript.js';
import { transcribeAudio } from '../services/transcribeService.js';

/**
 * Upload and transcribe an audio file, persist transcript to MongoDB,
 * and clean up temporary uploaded file in all scenarios.
 * POST /api/transcripts
 */
export const transcribe = async (req, res, next) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: 'No audio file uploaded. Please provide an audio file with the field name "audio".',
    });
  }

  try {
    // 1. Send file to Whisper service
    const transcriptionResult = await transcribeAudio(file.path);

    // 2. Save transcript record in MongoDB
    const newTranscript = await Transcript.create({
      text: transcriptionResult.text,
      originalFileName: file.originalname,
      fileSize: file.size,
      language: transcriptionResult.language,
      duration: transcriptionResult.duration,
    });

    // 3. Return created record
    return res.status(201).json({
      message: 'Audio transcribed and saved successfully',
      data: newTranscript,
    });
  } catch (error) {
    next(error);
  } finally {
    // 4. Always remove the temporary uploaded file from the server disk
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
 * Retrieve all transcripts sorted from newest to oldest.
 * GET /api/transcripts
 */
export const getAllTranscripts = async (req, res, next) => {
  try {
    const transcripts = await Transcript.find().sort({ createdAt: -1 });

    return res.status(200).json({
      count: transcripts.length,
      data: transcripts,
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

