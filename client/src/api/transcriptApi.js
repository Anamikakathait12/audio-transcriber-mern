import axios from 'axios';

// Base API URL with fallback to local development server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create a pre-configured Axios client instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5-minute timeout for diarization & large files
});

/**
 * Request Interceptor: Attach JWT Bearer token from localStorage to every request
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: On 401 unauthorized errors (session expired/invalid token),
 * clear storage and notify app to return to login screen.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      const isPublicEndpoint =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/demo/');

      if (!isPublicEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Dispatch custom window event so AuthContext can cleanly reset session state
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// ----------------- Authentication Endpoints (Step 7) ----------------- //

/**
 * Register a new user
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: Object }>}
 */
export const registerUser = async (name, email, password) => {
  const response = await apiClient.post('/auth/register', { name, email, password });
  return response.data;
};

/**
 * Log in an existing user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: Object }>}
 */
export const loginUser = async (email, password) => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

/**
 * Get currently authenticated user details
 * @returns {Promise<{ user: Object }>}
 */
export const getMe = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// ----------------- Transcript Endpoints ----------------- //

/**
 * Upload an audio file for transcription or speaker diarization.
 * 
 * @param {File} file - Audio file object from input or dropzone
 * @param {Function} [onProgress] - Optional upload progress callback (percent: number)
 * @param {Object} [options] - Options { detectSpeakers: boolean, language: string }
 * @returns {Promise<Object>} Created transcript object
 */
export const uploadAudio = async (file, onProgress, options = {}) => {
  const formData = new FormData();
  formData.append('audio', file);

  if (options?.detectSpeakers) {
    formData.append('detectSpeakers', 'true');
  }
  if (options?.language) {
    formData.append('language', options.language);
  }

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
 * Translate a transcript to target language ("en" | "hi").
 * 
 * @param {string} id - MongoDB transcript ID
 * @param {'en' | 'hi'} target - Target language code
 * @returns {Promise<{ message: string, data: Object, translation: Object }>}
 */
export const translateTranscript = async (id, target) => {
  const response = await apiClient.post(`/transcripts/${id}/translate`, { target });
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

// ----------------- Public Demo Endpoints (Step 10) ----------------- //

/**
 * Transcribe a guest audio file without an account (public demo).
 * 
 * @param {File} file - Audio file object
 * @param {Function} [onProgress] - Optional upload progress callback
 * @returns {Promise<{ text: string, language: string, duration: number|null, isDemo: boolean }>}
 */
export const demoTranscribe = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await apiClient.post('/demo/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

/**
 * Fetch guest demo restrictions and limits
 * @returns {Promise<{ maxFileMb: number, maxDurationSeconds: number, recordingLimitSeconds: number, rateLimitPerHour: number, allowedFormats: string[] }>}
 */
export const getDemoLimits = async () => {
  const response = await apiClient.get('/demo/limits');
  return response.data;
};

export default apiClient;
