import express from 'express';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';
import {
  transcribe,
  getAllTranscripts,
  getTranscriptById,
  deleteTranscript,
} from '../controllers/transcriptController.js';

const router = express.Router();

// Protect all transcript endpoints with JWT auth (Step 7)
router.use(protect);

// POST /api/transcripts - upload audio (field name 'audio') and transcribe
router.post('/', upload.single('audio'), transcribe);

// GET /api/transcripts - retrieve all transcripts for logged-in user
router.get('/', getAllTranscripts);

// GET /api/transcripts/:id - retrieve a single transcript by ID
router.get('/:id', getTranscriptById);

// DELETE /api/transcripts/:id - delete a transcript by ID
router.delete('/:id', deleteTranscript);

export default router;
