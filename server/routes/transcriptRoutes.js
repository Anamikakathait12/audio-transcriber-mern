import express from 'express';
import rateLimit from 'express-rate-limit';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';
import {
  transcribe,
  getAllTranscripts,
  getTranscriptById,
  deleteTranscript,
  translateTranscript,
} from '../controllers/transcriptController.js';

const router = express.Router();

// Rate limiter: 30 translation requests per hour per user
const translateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: {
    error: 'Translation rate limit exceeded (maximum 30 requests per hour). Please try again later.',
  },
});

// Protect all transcript endpoints with JWT auth (Step 7)
router.use(protect);

// POST /api/transcripts - upload audio (field name 'audio') and transcribe
router.post('/', upload.single('audio'), transcribe);

// GET /api/transcripts - retrieve all transcripts for logged-in user
router.get('/', getAllTranscripts);

// GET /api/transcripts/:id - retrieve a single transcript by ID
router.get('/:id', getTranscriptById);

// POST /api/transcripts/:id/translate - translate transcript to target language ('en' | 'hi')
router.post('/:id/translate', translateLimiter, translateTranscript);

// DELETE /api/transcripts/:id - delete a transcript by ID
router.delete('/:id', deleteTranscript);

export default router;
