import fs from 'fs/promises';

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

/**
 * Sleep helper for polling intervals
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Convert alphabetical speaker labels ("A", "B", "C"...) to numeric identifiers (1, 2, 3...)
 *
 * @param {string|number} speaker - Speaker identifier from AssemblyAI
 * @returns {number} 1-based speaker number
 */
const mapSpeakerLabelToNumber = (speaker) => {
  if (typeof speaker === 'number') return speaker;
  if (!speaker) return 1;

  const str = String(speaker).trim().toUpperCase();
  // If single letter A-Z
  if (str.length === 1 && str >= 'A' && str <= 'Z') {
    return str.charCodeAt(0) - 64; // 'A' -> 1, 'B' -> 2, etc.
  }

  // If already contains a number (e.g. "speaker_0" or "Speaker 1")
  const parsed = parseInt(str.replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 1 : parsed + 1;
};

/**
 * Transcribe and diarize audio using AssemblyAI with speaker labels.
 * All AssemblyAI-specific code is isolated in this service.
 *
 * @param {string} filePath - Path to temporary audio file on disk
 * @param {string} [language='hi'] - Target language code (default "hi" for Hindi)
 * @returns {Promise<{ text: string, language: string, duration: number|null, segments: Array<{ speaker: number, text: string, start: number, end: number }> }>}
 */
export const diarizeAudio = async (filePath, language = 'hi') => {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('ASSEMBLYAI_API_KEY is missing. Please add your AssemblyAI API key to server/.env.');
  }

  // 1. Read binary audio buffer from disk
  const fileBuffer = await fs.readFile(filePath);

  // 2. Upload file to AssemblyAI storage
  const uploadResponse = await fetch(`${ASSEMBLYAI_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      authorization: apiKey.trim(),
      'content-type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    if (uploadResponse.status === 401) {
      throw new Error('Invalid AssemblyAI API Key. Please verify your ASSEMBLYAI_API_KEY in server/.env.');
    }
    const errText = await uploadResponse.text();
    throw new Error(`Failed to upload audio to AssemblyAI: ${errText || uploadResponse.statusText}`);
  }

  const { upload_url } = await uploadResponse.json();
  if (!upload_url) {
    throw new Error('AssemblyAI did not return a valid upload URL.');
  }

  // 3. Submit transcription job with speaker labels enabled
  const transcriptResponse = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: {
      authorization: apiKey.trim(),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,
      language_code: language || 'hi',
    }),
  });

  if (!transcriptResponse.ok) {
    if (transcriptResponse.status === 401) {
      throw new Error('Invalid AssemblyAI API Key. Please verify your ASSEMBLYAI_API_KEY in server/.env.');
    }
    const errData = await transcriptResponse.json().catch(() => ({}));
    const message = errData.error || errData.message || transcriptResponse.statusText;

    if (message.toLowerCase().includes('quota') || message.toLowerCase().includes('credit')) {
      throw new Error('AssemblyAI account quota exceeded or insufficient credits. Please check your account balance.');
    }
    if (message.toLowerCase().includes('language')) {
      throw new Error(`AssemblyAI error: Unsupported or invalid language code "${language}".`);
    }

    throw new Error(`AssemblyAI transcription request failed: ${message}`);
  }

  const { id: transcriptId } = await transcriptResponse.json();

  // 4. Poll until completed or error
  const pollingUrl = `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`;
  const maxPollingAttempts = 120; // 120 * 2.5s = 5 minutes timeout
  let attempts = 0;

  while (attempts < maxPollingAttempts) {
    await sleep(2500);
    attempts++;

    const pollResponse = await fetch(pollingUrl, {
      method: 'GET',
      headers: { authorization: apiKey.trim() },
    });

    if (!pollResponse.ok) {
      throw new Error(`Error checking AssemblyAI transcription status (${pollResponse.status})`);
    }

    const result = await pollResponse.json();

    if (result.status === 'completed') {
      // Map utterances to segments with numeric speaker and start/end in seconds
      const segments = Array.isArray(result.utterances) && result.utterances.length > 0
        ? result.utterances.map((u) => ({
            speaker: mapSpeakerLabelToNumber(u.speaker),
            text: u.text || '',
            start: Math.round((u.start / 1000) * 100) / 100, // milliseconds to seconds
            end: Math.round((u.end / 1000) * 100) / 100,     // milliseconds to seconds
          }))
        : [
            {
              speaker: 1,
              text: result.text || '',
              start: 0,
              end: result.audio_duration ? Math.round(Number(result.audio_duration) * 100) / 100 : 0,
            },
          ];

      return {
        text: result.text || '',
        language: result.language_code || language || 'hi',
        duration: result.audio_duration !== undefined ? Number(result.audio_duration) : null,
        segments,
      };
    }

    if (result.status === 'error') {
      const err = result.error || 'AssemblyAI transcription failed.';
      if (err.toLowerCase().includes('quota') || err.toLowerCase().includes('credit')) {
        throw new Error('AssemblyAI account quota exceeded or insufficient credits. Please check your account.');
      }
      if (err.toLowerCase().includes('language')) {
        throw new Error(`AssemblyAI speaker detection does not support language code "${language}".`);
      }
      throw new Error(`AssemblyAI error: ${err}`);
    }
  }

  throw new Error('AssemblyAI speaker diarization timed out after 5 minutes.');
};

