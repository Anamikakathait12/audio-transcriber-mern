import fs from 'fs';
import Groq from 'groq-sdk';

/**
 * Transcribes an audio file using Groq's Whisper API (whisper-large-v3).
 * Keeps all Groq-specific logic isolated for easy replacement or adapter swapping.
 *
 * @param {string} filePath - Path to the local temporary audio file
 * @returns {Promise<{ text: string, language: string, duration: number|null }>}
 */
export const transcribeAudio = async (filePath) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing. Please set it in your server/.env file.');
  }

  // Initialize Groq client with the API key
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  // Create a readable stream from the uploaded file
  const audioStream = fs.createReadStream(filePath);

  // Call Whisper Large v3 via Groq
  const transcription = await groq.audio.transcriptions.create({
    file: audioStream,
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
  });

  return {
    text: transcription.text,
    language: transcription.language || 'unknown',
    duration: transcription.duration !== undefined && transcription.duration !== null
      ? Number(transcription.duration)
      : null,
  };
};

