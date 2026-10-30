import express from 'express';
import upload from '../middleware/upload.js';
import {
  transcribe,
  getAllTranscripts,
  getTranscriptById,
  deleteTranscript,
} from '../controllers/transcriptController.js';

const router = express.Router();

// POST /api/transcripts - upload audio (field name 'audio') and transcribe
router.post('/', upload.single('audio'), transcribe);

// GET /api/transcripts - retrieve all transcripts
router.get('/', getAllTranscripts);

// GET /api/transcripts/:id - retrieve a single transcript by ID
router.get('/:id', getTranscriptById);

// DELETE /api/transcripts/:id - delete a transcript by ID
router.delete('/:id', deleteTranscript);

export default router;

