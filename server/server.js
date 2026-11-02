import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import connectDB from './config/db.js';
import transcriptRoutes from './routes/transcriptRoutes.js';
import authRoutes from './routes/authRoutes.js';

// Load environment variables from .env
dotenv.config();

// Enforce JWT_SECRET requirement before starting
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  console.error('❌ [FATAL ERROR] JWT_SECRET is not set in environment variables.');
  console.error('❌ The server refuses to start without a valid JWT_SECRET.');
  process.exit(1);
}

// Connect to MongoDB Atlas
await connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable reverse proxy trust (Render / Vercel / Nginx) so rate limiters see the real client IP
app.set('trust proxy', 1);

// Standard Middlewares
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL, // set this in Render, e.g. https://audio-transcriber-mern.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check route (Public)
 * Used to verify server status from frontend or monitoring tools
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Audiqo API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes (Step 7)
app.use('/api/auth', authRoutes);

// Transcript routes (Protected)
app.use('/api/transcripts', transcriptRoutes);

// Fallback 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err.message || err);

  // 1. Handle Multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum allowed file size is 25 MB.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: `Unexpected field '${err.field}'. Please upload audio using the form field name 'audio'.`,
      });
    }
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
    });
  }

  // 2. Handle invalid file type error from fileFilter
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: err.message,
    });
  }

  // 3. Handle Mongoose CastError (e.g., malformed ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Invalid format for field '${err.path}'`,
    });
  }

  // 4. Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      error: 'Validation failed',
      details: messages,
    });
  }

  // 5. Default generic error response
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 [Server] Running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});
