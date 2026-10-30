import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure temporary uploads directory exists
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed audio extensions and MIME types
const ALLOWED_EXTENSIONS = /\.(mp3|wav|m4a|webm|ogg)$/i;
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
];

// Configure disk storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `audio-${uniqueSuffix}${ext}`);
  },
});

// File filter checking extension and MIME type
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtAllowed = ALLOWED_EXTENSIONS.test(ext);
  const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('audio/');

  if (isExtAllowed && isMimeAllowed) {
    return cb(null, true);
  }

  return cb(
    new Error('Invalid file type. Only audio files (.mp3, .wav, .m4a, .webm, .ogg) are allowed.'),
    false
  );
};

// 25 MB max file size limit (Groq Whisper limit)
const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB in bytes
  },
  fileFilter,
});

export default upload;

