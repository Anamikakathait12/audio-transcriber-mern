import { useState, useEffect } from 'react';
import { checkHealth, uploadAudio } from './api/transcriptApi.js';
import UploadBox from './components/UploadBox.jsx';
import TranscriptResult from './components/TranscriptResult.jsx';
import HistoryList from './components/HistoryList.jsx';

function App() {
  // Server Health State (from Step 1)
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'connected' | 'down'
  const [lastChecked, setLastChecked] = useState(null);

  // Transcription & Upload States (Step 3)
  const [currentTranscript, setCurrentTranscript] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // History Refresh Trigger (Step 4)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  // Backend Error State
  const [backendError, setBackendError] = useState(null);

  /**
   * Verify backend server health
   */
  const handleCheckHealth = async () => {
    setServerStatus('checking');
    try {
      const data = await checkHealth();
      if (data && data.status === 'ok') {
        setServerStatus('connected');
        setLastChecked(new Date().toLocaleTimeString());
      } else {
        setServerStatus('down');
      }
    } catch (error) {
      console.error('Server health check failed:', error.message);
      setServerStatus('down');
    }
  };

  useEffect(() => {
    handleCheckHealth();
  }, []);

  /**
   * Send audio file to backend for Whisper transcription
   */
  const handleUploadAudio = async (file) => {
    setBackendError(null);
    setIsUploading(true);
    setIsTranscribing(false);
    setUploadProgress(0);

    try {
      const response = await uploadAudio(file, (percent) => {
        setUploadProgress(percent);
        // Once the upload reaches 100%, backend starts the Whisper transcription
        if (percent >= 100) {
          setIsUploading(false);
          setIsTranscribing(true);
        }
      });

      if (response && response.data) {
        setCurrentTranscript(response.data);
        // Automatically refresh history list when a new upload finishes (Step 4)
        setHistoryRefreshTrigger((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Transcription request failed:', err);
      // Extract clean error message from backend response if available
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to transcribe audio. Please make sure the server is running.';
      setBackendError(errorMsg);
    } finally {
      setIsUploading(false);
      setIsTranscribing(false);
      setUploadProgress(0);
    }
  };

  /**
   * Handle cleanup if the currently viewed transcript is deleted from history
   */
  const handleTranscriptDeleted = (deletedId) => {
    if (currentTranscript && currentTranscript._id === deletedId) {
      setCurrentTranscript(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full">
        {/* Top Header & Server Health Status Bar */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <span>🎙️ Audio to Text Transcriber</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Powered by Groq Whisper Large v3, Express, & React
            </p>
          </div>

          {/* Step 1 Health Indicator Pill */}
          <div className="flex items-center space-x-3 bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-xl shadow-sm self-start sm:self-auto">
            <span className="text-xs text-slate-400 font-medium">Server:</span>

            {serverStatus === 'checking' && (
              <div className="flex items-center space-x-1.5 text-xs text-amber-400 font-medium">
                <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full" />
                <span>Checking...</span>
              </div>
            )}

            {serverStatus === 'connected' && (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-950 animate-pulse" />
                <span>Server connected</span>
              </div>
            )}

            {serverStatus === 'down' && (
              <div className="flex items-center space-x-1.5 text-xs text-rose-400 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-950" />
                <span>Server down</span>
              </div>
            )}

            <button
              onClick={handleCheckHealth}
              disabled={serverStatus === 'checking'}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-700/60"
              title="Recheck Server Health"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Backend Error Alert Box */}
        {backendError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 shadow-md flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-rose-300">Backend Error</h4>
                <p className="text-xs text-rose-200 mt-0.5">{backendError}</p>
              </div>
            </div>

            <button
              onClick={() => setBackendError(null)}
              className="text-rose-400 hover:text-rose-200 p-1 rounded-lg hover:bg-rose-900/50 transition-colors"
              title="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Audio Upload Box (Step 3) */}
        <section aria-label="Upload Section">
          <UploadBox
            onUpload={handleUploadAudio}
            isUploading={isUploading}
            isTranscribing={isTranscribing}
            uploadProgress={uploadProgress}
          />
        </section>

        {/* Current Transcription Output Display (Step 3) */}
        <section aria-label="Current Transcription Result">
          <TranscriptResult
            transcript={currentTranscript}
            onClear={() => setCurrentTranscript(null)}
          />
        </section>

        {/* Transcript History List (Step 4) */}
        <section aria-label="Transcription History">
          <HistoryList
            refreshTrigger={historyRefreshTrigger}
            onTranscriptDeleted={handleTranscriptDeleted}
          />
        </section>
      </div>

      {/* Subtle Footer */}
      <footer className="text-center text-xs text-slate-500 mt-12">
        <p>Audio to Text Transcriber &bull; MERN Stack Step 4 &bull; Whisper Large v3</p>
      </footer>
    </div>
  );
}

export default App;
