import { useState, useEffect, useRef } from 'react';
import { checkHealth, uploadAudio, getTranscripts } from './api/transcriptApi.js';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import UploadBox from './components/UploadBox.jsx';
import Recorder from './components/Recorder.jsx';
import TranscriptResult from './components/TranscriptResult.jsx';
import HistoryList from './components/HistoryList.jsx';
import {
  UploadCloud,
  Mic,
  Users,
  Sparkles,
  ArrowRight,
  FileAudio,
  Clock,
  Calendar,
  AlertCircle,
  RefreshCw,
  AudioWaveform,
  CheckCircle2,
} from 'lucide-react';

/**
 * Format duration in seconds to a human-friendly string (e.g. "1m 14s" or "24s")
 */
const formatDuration = (seconds) => {
  if (seconds === undefined || seconds === null) return 'N/A';
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

/**
 * Format date to short readable string
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

function App() {
  // Authentication State (Step 7)
  const { user, loading: authLoading, logout, isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'

  // Server Health State (Step 1)
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'connected' | 'down'
  const [lastChecked, setLastChecked] = useState(null);

  // SaaS Navigation: 'transcribe' | 'history' (Step 8)
  const [currentView, setCurrentView] = useState('transcribe');
  const [searchTerm, setSearchTerm] = useState('');

  // Active Tab inside Transcribe view: 'upload' | 'record' (Step 5)
  const [activeTab, setActiveTab] = useState('upload');

  // Speaker Detection Setting (Step 6)
  const [detectSpeakers, setDetectSpeakers] = useState(false);

  // Transcription & Upload States (Step 3)
  const [currentTranscript, setCurrentTranscript] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // History Refresh Trigger & Recent Transcripts (Steps 4 & 8)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);
  const [recentTranscripts, setRecentTranscripts] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Backend Error State
  const [backendError, setBackendError] = useState(null);

  // Scroll target ref for "Start transcribing" button
  const workspaceRef = useRef(null);

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
   * Fetch recent 6 transcripts for the home dashboard grid
   */
  useEffect(() => {
    const fetchRecent = async () => {
      if (!isAuthenticated) return;
      setRecentLoading(true);
      try {
        const response = await getTranscripts({ page: 1, limit: 6 });
        const list = response.transcripts || response.data || [];
        setRecentTranscripts(list);
      } catch (err) {
        console.error('Failed to load recent transcripts:', err);
      } finally {
        setRecentLoading(false);
      }
    };

    fetchRecent();
  }, [isAuthenticated, historyRefreshTrigger]);

  /**
   * Handle user logout
   */
  const handleLogout = () => {
    logout();
    setCurrentTranscript(null);
    setBackendError(null);
    setRecentTranscripts([]);
  };

  /**
   * Send audio file (uploaded or recorded) to backend
   */
  const handleUploadAudio = async (file, options = {}) => {
    setBackendError(null);
    setIsUploading(true);
    setIsTranscribing(false);
    setUploadProgress(0);

    const mergedOptions = {
      detectSpeakers: options.detectSpeakers !== undefined ? options.detectSpeakers : detectSpeakers,
      ...options,
    };

    try {
      const response = await uploadAudio(
        file,
        (percent) => {
          setUploadProgress(percent);
          if (percent >= 100) {
            setIsUploading(false);
            setIsTranscribing(true);
          }
        },
        mergedOptions
      );

      if (response && response.data) {
        setCurrentTranscript(response.data);
        // Automatically refresh history lists
        setHistoryRefreshTrigger((prev) => prev + 1);
        // Scroll to transcript result
        setTimeout(() => {
          workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error('Transcription request failed:', err);
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
   * Handle cleanup if current transcript is deleted from history
   */
  const handleTranscriptDeleted = (deletedId) => {
    if (currentTranscript && currentTranscript._id === deletedId) {
      setCurrentTranscript(null);
    }
    setHistoryRefreshTrigger((prev) => prev + 1);
  };

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ----------------- Auth State Loading ----------------- //
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <AudioWaveform className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-slate-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // ----------------- Unauthenticated View (Login / Register) ----------------- //
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
        {/* Top Header with Server Health Check */}
        <div className="max-w-md w-full mx-auto flex items-center justify-between pb-6">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <AudioWaveform className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">Audiqo</span>
          </div>

          {/* Health Pill */}
          <div
            onClick={handleCheckHealth}
            title="Click to check server health"
            className="cursor-pointer flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border transition duration-150 bg-white border-slate-200 hover:bg-slate-50 shadow-xs"
          >
            {serverStatus === 'checking' && (
              <div className="flex items-center space-x-1 text-amber-600">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                <span>Connecting...</span>
              </div>
            )}
            {serverStatus === 'connected' && (
              <div className="flex items-center space-x-1.5 text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Server Online</span>
              </div>
            )}
            {serverStatus === 'down' && (
              <div className="flex items-center space-x-1.5 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Server Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Auth Page: Login or Register */}
        <div className="flex-1 flex items-center justify-center">
          {authView === 'login' ? (
            <Login onSwitchToRegister={() => setAuthView('register')} />
          ) : (
            <Register onSwitchToLogin={() => setAuthView('login')} />
          )}
        </div>

        {/* Footer */}
        <div className="text-center pt-8 text-xs text-slate-600">
          Audiqo - powered by Whisper
        </div>
      </div>
    );
  }

  // ----------------- Authenticated SaaS Dashboard ----------------- //
  return (
    <DashboardLayout
      currentView={currentView}
      setCurrentView={setCurrentView}
      user={user}
      onLogout={handleLogout}
      serverStatus={serverStatus}
      onRefreshHealth={handleCheckHealth}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      detectSpeakers={detectSpeakers}
      setDetectSpeakers={setDetectSpeakers}
    >
      {currentView === 'transcribe' ? (
        <div className="space-y-8">
          {/* Welcome Heading with Serif Italic Name */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex flex-wrap items-baseline gap-2">
              <span>Welcome,</span>
              <span className="font-serif italic text-3xl sm:text-4xl text-indigo-700 font-normal">
                {user?.name || 'Friend'}
              </span>
              <span>👋</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Upload or record audio and get accurate text with speaker detection.
            </p>
          </div>

          {/* Soft Blue-to-Teal Gradient Hero Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/80 via-teal-50/60 to-indigo-50/80 border border-blue-200/60 p-6 sm:p-8 transition duration-150">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-blue-200/80 text-xs font-medium text-indigo-700 mb-3 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Next-Gen Audio Intelligence</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Turn any audio into text
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Transform voice memos, interviews, meetings, and recordings into accurate transcripts.
                Enable speaker detection to automatically label who spoke when with AssemblyAI.
              </p>
              <div className="mt-5 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={scrollToWorkspace}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition duration-150 flex items-center space-x-2"
                >
                  <span>Start transcribing</span>
                  <ArrowRight className="w-4 h-4 text-indigo-300" />
                </button>
              </div>
            </div>

            {/* Subtle Decorative Waveform in Background */}
            <div className="absolute right-4 -bottom-6 opacity-10 pointer-events-none hidden sm:block">
              <AudioWaveform className="w-56 h-56 text-slate-900" />
            </div>
          </div>

          {/* 3 Quick Action Tiles */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tile 1: Upload File */}
              <div
                onClick={() => {
                  setActiveTab('upload');
                  scrollToWorkspace();
                }}
                className={`p-5 rounded-2xl border transition duration-150 cursor-pointer bg-white ${
                  activeTab === 'upload'
                    ? 'border-indigo-300 ring-2 ring-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  {activeTab === 'upload' && (
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      Active
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">Upload file</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Upload MP3, WAV, M4A, WEBM, OGG, OGA, or OPUS audio up to 25 MB.
                </p>
              </div>

              {/* Tile 2: Record Audio */}
              <div
                onClick={() => {
                  setActiveTab('record');
                  scrollToWorkspace();
                }}
                className={`p-5 rounded-2xl border transition duration-150 cursor-pointer bg-white ${
                  activeTab === 'record'
                    ? 'border-indigo-300 ring-2 ring-indigo-500/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                    <Mic className="w-5 h-5" />
                  </div>
                  {activeTab === 'record' && (
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      Active
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">Record audio</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Record live speech from your microphone with timer and audio preview.
                </p>
              </div>

              {/* Tile 3: Speaker Detection */}
              <div
                onClick={() => setDetectSpeakers(!detectSpeakers)}
                className={`p-5 rounded-2xl border transition duration-150 cursor-pointer bg-white ${
                  detectSpeakers
                    ? 'border-indigo-400 ring-2 ring-indigo-500/15'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      detectSpeakers
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {detectSpeakers ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Speaker detection</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Click to toggle AssemblyAI speaker diarization on or off.
                </p>
              </div>
            </div>
          </div>

          {/* Main Transcribing Workspace */}
          <div ref={workspaceRef} className="space-y-6">
            {/* Tab Switcher */}
            <div className="flex items-center space-x-1.5 p-1 bg-slate-200/60 rounded-xl max-w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition duration-150 flex items-center space-x-2 ${
                  activeTab === 'upload'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload file</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition duration-150 flex items-center space-x-2 ${
                  activeTab === 'record'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Record audio</span>
              </button>
            </div>

            {/* Backend Error Alert */}
            {backendError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start space-x-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">Transcription failed</span>
                  <p className="mt-0.5 text-rose-600">{backendError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBackendError(null)}
                  className="text-rose-400 hover:text-rose-600 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Active Workspace Component */}
            {activeTab === 'upload' ? (
              <UploadBox
                onUpload={handleUploadAudio}
                isUploading={isUploading}
                isTranscribing={isTranscribing}
                uploadProgress={uploadProgress}
                detectSpeakers={detectSpeakers}
                setDetectSpeakers={setDetectSpeakers}
              />
            ) : (
              <Recorder
                onUpload={handleUploadAudio}
                isUploading={isUploading}
                isTranscribing={isTranscribing}
                uploadProgress={uploadProgress}
                detectSpeakers={detectSpeakers}
                setDetectSpeakers={setDetectSpeakers}
              />
            )}

            {/* Transcript Result Box (Rendered immediately after transcription) */}
            {currentTranscript && (
              <TranscriptResult
                transcript={currentTranscript}
                onClear={() => setCurrentTranscript(null)}
              />
            )}
          </div>

          {/* Recent Transcripts Grid (up to 6 cards) */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Recent Transcripts
                </h2>
                <p className="text-xs text-slate-600">
                  Quick access to your latest transcriptions
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCurrentView('history')}
                className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 group"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition duration-150" />
              </button>
            </div>

            {recentLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded-2xl border border-slate-200 bg-white animate-pulse space-y-3"
                  >
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                  </div>
                ))}
              </div>
            ) : recentTranscripts.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <FileAudio className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">No transcripts yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Upload an audio file or record speech above to see results here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentTranscripts.map((item) => {
                  const hasSegments = Array.isArray(item.segments) && item.segments.length > 0;
                  const speakerCount =
                    item.speakerCount || (hasSegments ? new Set(item.segments.map((s) => s.speaker)).size : 0);
                  const rawText =
                    item.text || (hasSegments ? item.segments.map((s) => s.text).join(' ') : '');
                  const preview = rawText.length > 95 ? `${rawText.slice(0, 95).trim()}...` : rawText;

                  return (
                    <div
                      key={item._id}
                      onClick={() => {
                        setCurrentTranscript(item);
                        scrollToWorkspace();
                      }}
                      className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition duration-150 cursor-pointer flex flex-col justify-between group shadow-2xs hover:shadow-xs"
                    >
                      <div>
                        {/* Header: File Name & Speaker Diarization Badge */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                              <FileAudio className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                              {item.originalFileName || 'Recording'}
                            </span>
                          </div>

                          {hasSegments && (
                            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 flex-shrink-0">
                              {speakerCount}spk
                            </span>
                          )}
                        </div>

                        {/* Text preview */}
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                          {preview || 'Audio transcribed successfully.'}
                        </p>
                      </div>

                      {/* Footer Metadata */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>{formatDuration(item.duration)}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-600" />
                          <span>{formatDate(item.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Page View */
        <HistoryList
          refreshTrigger={historyRefreshTrigger}
          onTranscriptDeleted={handleTranscriptDeleted}
          externalSearch={searchTerm}
          setExternalSearch={setSearchTerm}
        />
      )}
    </DashboardLayout>
  );
}

export default App;
