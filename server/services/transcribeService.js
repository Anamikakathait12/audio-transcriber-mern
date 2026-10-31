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

  // Groq detects audio format from the file name and may reject ".oga".
  // Before sending, if the file extension is .oga, rename it with an .ogg extension.
  const isOga = filePath.toLowerCase().endsWith('.oga');
  let activeFilePath = filePath;
  let wasRenamed = false;

  if (isOga) {
    activeFilePath = filePath.replace(/\.oga$/i, '.ogg');
    await fs.promises.rename(filePath, activeFilePath);
    wasRenamed = true;
  }

  try {
    // Create a readable stream from the (possibly renamed) temporary audio file
    const audioStream = fs.createReadStream(activeFilePath);

    // Call Whisper Large v3 via Groq with verbose_json for metadata
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
  } finally {
    // Restore original file path so caller's cleanup (fs.unlink(filePath)) can delete it
    if (wasRenamed) {
      try {
        if (fs.existsSync(activeFilePath)) {
          await fs.promises.rename(activeFilePath, filePath);
        }
      } catch (restoreErr) {
        // Fallback: if restoring fails, clean up directly so no orphaned file remains
        try {
          await fs.promises.unlink(activeFilePath);
        } catch (_) {}
      }
    }
  }
};
