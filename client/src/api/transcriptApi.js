import axios from 'axios';

// Base API URL with fallback to local development server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create a pre-configured Axios client instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2-minute timeout for large audio files
});

/**
 * Upload an audio file for Whisper transcription.
 * 
 * @param {File} file - Audio file object from input or dropzone
 * @param {Function} [onProgress] - Optional upload progress callback (percent: number)
 * @returns {Promise<Object>} Created transcript object
 */
export const uploadAudio = async (file, onProgress) => {
  const formData = new FormData();
  // Field name MUST match multer backend config: "audio"
  formData.append('audio', file);

  const response = await apiClient.post('/transcripts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

/**
 * Fetch transcripts with optional search and pagination.
 * 
 * @param {Object} [params] - Query parameters { search, page, limit }
 * @returns {Promise<{ transcripts: Array, total: number, page: number, totalPages: number }>}
 */
export const getTranscripts = async (params = {}) => {
  const response = await apiClient.get('/transcripts', { params });
  return response.data;
};

/**
 * Fetch a single transcript by its ID.
 * 
 * @param {string} id - MongoDB transcript ID
 * @returns {Promise<Object>} Transcript object
 */
export const getTranscriptById = async (id) => {
  const response = await apiClient.get(`/transcripts/${id}`);
  return response.data;
};

/**
 * Delete a transcript by ID.
 * 
 * @param {string} id - MongoDB transcript ID
 * @returns {Promise<Object>} Deletion confirmation response
 */
export const deleteTranscript = async (id) => {
  const response = await apiClient.delete(`/transcripts/${id}`);
  return response.data;
};

/**
 * Check backend server health status.
 * 
 * @returns {Promise<Object>} Health check payload { status: 'ok' }
 */
export const checkHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export default apiClient;
