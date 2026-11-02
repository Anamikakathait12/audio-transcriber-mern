import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { transcribeAudio } from '../services/transcribeService.js';

const router = express.Router();

// Ensure temporary uploads directory exists
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// In-memory daily global cap (resets at midnight UTC)
let dailyCount = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

const checkDailyCap = (req, res, next) => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDate) {
    dailyCount = 0;
    lastResetDate = today;
  }
  const maxDaily = parseInt(process.env.DEMO_DAILY_CAP, 10) || 100;
  if (dailyCount >= maxDaily) {
    return res.status(429).json({
      error: 'Daily guest demo limit reached. Please sign up or log in for unlimited transcription.',
      code: 'DAILY_CAP_REACHED',
    });
  }
  next();
};

// Rate limiter per IP for guest demo (default: 5 requests per hour)
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.DEMO_RATE_LIMIT_PER_HOUR, 10) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many demo requests from this IP. Please wait an hour or create a free account to continue.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Allowed audio extensions and MIME types
const ALLOWED_EXTENSIONS = /\.(mp3|wav|m4a|webm|ogg|oga|opus)$/i;
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'application/ogg',
  'audio/x-oga',
  'audio/opus',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `demo-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtAllowed = ALLOWED_EXTENSIONS.test(ext);
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('audio/');

  if (isExtAllowed && isMimeAllowed) {
    return cb(null, true);
  }

  return cb(
    new Error('Invalid file type. Only audio files (.mp3, .wav, .m4a, .webm, .ogg, .oga, .opus) are allowed.'),
    false
  );
};

const maxFileMb = parseInt(process.env.DEMO_MAX_FILE_MB, 10) || 3;
const demoUpload = multer({
  storage,
  limits: {
    fileSize: maxFileMb * 1024 * 1024,
  },
  fileFilter,
});

// Custom upload handler to provide clear demo-specific file size errors
const handleDemoUpload = (req, res, next) => {
  demoUpload.single('audio')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        const mb = parseInt(process.env.DEMO_MAX_FILE_MB, 10) || 3;
        return res.status(400).json({
          error: `Guest demo file is too large. Maximum allowed file size is ${mb} MB. Create an account for up to 25 MB.`,
        });
      }
      return next(err);
    }
    next();
  });
};

/**
 * GET /api/demo/limits
 * Returns public configuration and constraints for guest users
 */
router.get('/limits', (req, res) => {
  const fileMb = parseInt(process.env.DEMO_MAX_FILE_MB, 10) || 3;
  const maxSeconds = parseInt(process.env.DEMO_MAX_SECONDS, 10) || 90;
  const rateLimitVal = parseInt(process.env.DEMO_RATE_LIMIT_PER_HOUR, 10) || 5;

  return res.status(200).json({
    maxFileMb: fileMb,
    maxDurationSeconds: maxSeconds,
    recordingLimitSeconds: 60,
    rateLimitPerHour: rateLimitVal,
    allowedFormats: ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'oga', 'opus'],
  });
});

/**
 * POST /api/demo/transcribe
 * Public endpoint for guest demo audio transcription (Groq Whisper only).
 * Audio is NEVER persisted to MongoDB and temporary files are deleted immediately.
 */
router.post('/transcribe', demoLimiter, checkDailyCap, handleDemoUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Please upload an audio file using the "audio" form field.',
    });
  }

  const filePath = req.file.path;

  try {
    const result = await transcribeAudio(filePath);
    const maxSeconds = parseInt(process.env.DEMO_MAX_SECONDS, 10) || 90;

    if (result.duration && result.duration > maxSeconds) {
      return res.status(400).json({
        error: `Audio duration (${Math.round(result.duration)}s) exceeds guest demo limit of ${maxSeconds} seconds. Sign up for free to transcribe longer audio.`,
      });
    }

    // Increment global cap only after successful transcription
    dailyCount += 1;

    return res.status(200).json({
      text: result.text,
      language: result.language,
      duration: result.duration,
      isDemo: true,
    });
  } catch (error) {
    console.error('Demo transcription error:', error.message || error);
    return res.status(500).json({
      error: error.message || 'Failed to transcribe demo audio.',
    });
  } finally {
    // ALWAYS remove guest audio file from disk
    if (fs.existsSync(filePath)) {
      try {
        await fs.promises.unlink(filePath);
      } catch (cleanupErr) {
        console.error('Failed to unlink guest demo temp file:', cleanupErr.message);
      }
    }
  }
});

export default router;

