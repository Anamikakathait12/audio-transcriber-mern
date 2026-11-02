import { useState, useRef, useEffect } from 'react';
import {
  AudioWaveform,
  UploadCloud,
  Mic,
  Square,
  Trash2,
  Check,
  Copy,
  Download,
  ArrowRight,
  Sparkles,
  Users,
  Languages,
  Clock,
  FileAudio,
  ShieldCheck,
  Zap,
  History,
  FileText,
  ChevronDown,
  Volume2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';
import { demoTranscribe } from '../api/transcriptApi.js';
import { SAMPLE_TRANSCRIPT } from '../data/sampleTranscript.js';

const DEMO_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const DEMO_MAX_REC_SECONDS = 60; // 60 seconds
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.oga', '.opus'];

const formatDuration = (seconds) => {
  if (seconds === undefined || seconds === null) return 'N/A';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatTimestamp = (seconds) => {
  if (seconds === undefined || seconds === null) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatLanguageName = (lang) => {
  if (!lang) return '';
  const l = String(lang).toLowerCase().trim();
  if (l === 'en' || l.startsWith('en_') || l.startsWith('en-') || l === 'english') return 'English';
  if (l === 'hi' || l.startsWith('hi_') || l.startsWith('hi-') || l === 'hindi') return 'Hindi';
  if (l === 'es') return 'Spanish';
  if (l === 'fr') return 'French';
  if (l === 'de') return 'German';
  return l.toUpperCase();
};

const FAQ_ITEMS = [
  {
    q: 'What audio formats are supported?',
    a: 'Audiqo supports MP3, WAV, M4A, WEBM, OGG, OGA, and OPUS audio files. You can upload an audio file or record directly from your microphone.',
  },
  {
    q: 'How accurate is the transcription?',
    a: 'We use Whisper Large v3 powered by Groq LPUs. It delivers state-of-the-art accuracy with sub-second latency across English, Hindi, and multilingual speech.',
  },
  {
    q: 'Do you store my audio files?',
    a: 'No. Guest demo audio files are removed from the server immediately after transcription. For registered members, we save only the transcript text and timestamps in your private account; audio recordings are never permanently stored.',
  },
  {
    q: 'What languages are supported?',
    a: 'Whisper auto-detects over 50+ languages. Registered accounts can also translate any transcript between English and Hindi with full speaker segment alignment.',
  },
  {
    q: 'Is Audiqo really free?',
    a: 'Yes! Both the guest demo and the registered user tier are completely free to use without requiring any credit card.',
  },
];

export default function Landing({ navigate, isAuthenticated, user }) {
  // Demo card state
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'record'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [apiError, setApiError] = useState('');

  // Mic recording state
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording' | 'recorded'
  const [recDuration, setRecDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // Result state
  const [demoResult, setDemoResult] = useState(null);
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [sampleLangTab, setSampleLangTab] = useState('original'); // 'original' | 'en'
  const [copied, setCopied] = useState(false);

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState(null);

  // Refs
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chunksRef = useRef([]);
  const resultRef = useRef(null);

  // Auto-stop recording at 60 seconds
  useEffect(() => {
    if (recordingState === 'recording' && recDuration >= DEMO_MAX_REC_SECONDS) {
      handleStopRecording();
    }
  }, [recDuration, recordingState]);

  // Clean up recording hardware tracks and audio URLs
  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopMediaTracks();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // File drag & drop validation
  const validateFile = (file) => {
    if (!file) return 'Please choose an audio file.';
    const name = file.name || '';
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeAllowed = file.type.startsWith('audio/') || file.type === 'video/webm' || file.type === 'application/ogg';

    if (!isExtAllowed && !isMimeAllowed) {
      return 'Unsupported format. Please upload MP3, WAV, M4A, WEBM, OGG, OGA, or OPUS.';
    }

    if (file.size > DEMO_MAX_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return `File is ${mb} MB. Guest demo files are limited to 3 MB. Create a free account for up to 25 MB.`;
    }

    return null;
  };

  const handleFileSelect = (file) => {
    setValidationError('');
    setApiError('');
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  // Recording controls
  const handleStartRecording = async () => {
    setValidationError('');
    setApiError('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setValidationError('Microphone recording is not supported in this browser. Please use Chrome, Safari, Firefox, or Edge.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const newUrl = URL.createObjectURL(finalBlob);
        setRecordedBlob(finalBlob);
        setAudioUrl(newUrl);
        setRecordingState('recorded');
        stopMediaTracks();
      };

      recorder.start(250);
      setRecDuration(0);
      setRecordingState('recording');

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setValidationError('Microphone permission was denied. Please allow microphone access in your browser settings.');
      setRecordingState('idle');
    }
  };

  const handleStopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDiscardRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    stopMediaTracks();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordedBlob(null);
    setRecDuration(0);
    setRecordingState('idle');
  };

  // Submit transcription (file or recording)
  const handleSubmitDemo = async () => {
    setApiError('');
    let fileToUpload = null;

    if (activeTab === 'upload') {
      if (!selectedFile) {
        setValidationError('Please select an audio file first.');
        return;
      }
      fileToUpload = selectedFile;
    } else {
      if (!recordedBlob) {
        setValidationError('Please record an audio clip first.');
        return;
      }
      fileToUpload = new File([recordedBlob], `recording-${Date.now()}.webm`, {
        type: 'audio/webm',
      });
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      const data = await demoTranscribe(fileToUpload, (percent) => {
        setUploadProgress(percent);
      });

      setDemoResult({
        text: data.text,
        language: data.language,
        duration: data.duration,
        isDemo: true,
        fileName: fileToUpload.name,
      });
      setIsSampleMode(false);

      // Smooth scroll to results
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      console.error('Demo transcription error:', err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to transcribe audio. Please verify your connection and try again.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Load sample result
  const handleLoadSample = () => {
    setValidationError('');
    setApiError('');
    setIsSampleMode(true);
    setSampleLangTab('original');
    setDemoResult({
      text: SAMPLE_TRANSCRIPT.originalText,
      language: SAMPLE_TRANSCRIPT.language,
      duration: SAMPLE_TRANSCRIPT.duration,
      isDemo: true,
      fileName: SAMPLE_TRANSCRIPT.fileName,
    });
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  // Copy text helper
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download .txt helper
  const handleDownload = (text, fileName = 'audiqo-transcript.txt') => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center space-x-2.5 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <AudioWaveform className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-900 text-base tracking-tight">Audiqo</span>
                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-600 hidden sm:block">Speech to text engine</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-slate-900 transition">
              How it works
            </a>
            <a href="#features" className="hover:text-slate-900 transition">
              Features
            </a>
            <a href="#comparison" className="hover:text-slate-900 transition">
              Comparison
            </a>
            <a href="#faq" className="hover:text-slate-900 transition">
              FAQ
            </a>
          </nav>

          {/* Right Auth CTA */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition duration-150 flex items-center space-x-2"
              >
                <span>Open dashboard</span>
                <ArrowRight className="w-4 h-4 text-indigo-300" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 transition"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition duration-150 flex items-center space-x-1.5"
                >
                  <span>Sign up free</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="pt-12 sm:pt-20 pb-10 px-4 sm:px-6 text-center">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Pill Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-xs font-medium text-indigo-700">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Whisper Large v3 on Groq LPUs</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Turn any audio into{' '}
              <span className="font-serif italic font-normal text-indigo-600">accurate</span>{' '}
              text
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto leading-relaxed">
              Fast, dependable speech transcription for Hindi, English and more. No sign-up needed to try.
            </p>
          </div>

          {/* 3. Try-It Guest Demo Card */}
          <div className="max-w-2xl mx-auto mt-8 sm:mt-10">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 text-left">
              {/* Card Tabs: File upload | Record audio */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('upload');
                    setValidationError('');
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <span>File upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('record');
                    setValidationError('');
                  }}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'record'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mic className="w-4 h-4 text-indigo-600" />
                  <span>Record audio</span>
                </button>
              </div>

              {/* Error messages banner */}
              {(validationError || apiError) && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                  <span className="flex-1">{validationError || apiError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError('');
                      setApiError('');
                    }}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Tab 1: File Upload */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.wav,.m4a,.webm,.ogg,.oga,.opus,audio/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {!selectedFile ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileSelect(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
                        isDragOver
                          ? 'border-indigo-500 bg-indigo-50/50'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-700">
                        <UploadCloud className="w-6 h-6 text-indigo-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        Drop your audio file here, or{' '}
                        <span className="text-indigo-600 underline">browse</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-1.5">
                        MP3, WAV, M4A, WEBM, OGG &bull; <strong className="text-slate-700">3 MB limit for guest demo</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="flex items-center space-x-3 truncate">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                          <FileAudio className="w-5 h-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-slate-600">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready to transcribe
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Record Audio */}
              {activeTab === 'record' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center">
                  {recordingState === 'idle' && (
                    <div className="flex flex-col items-center space-y-3 max-w-sm">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                        <Mic className="w-6 h-6 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Record from Microphone</h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Up to 60 seconds for guest demo. Auto-stops automatically.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        disabled={isLoading}
                        className="mt-1 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition flex items-center space-x-2"
                      >
                        <Mic className="w-4 h-4 text-rose-400" />
                        <span>Start Recording</span>
                      </button>
                    </div>
                  )}

                  {recordingState === 'recording' && (
                    <div className="flex flex-col items-center space-y-4">
                      <div className="flex items-center space-x-3 px-4 py-2 bg-rose-50 border border-rose-200 rounded-full">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                          Recording
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {formatTimer(recDuration)}
                        </span>
                        <span className="text-xs text-slate-600 font-mono">/ 01:00</span>
                      </div>
                      <p className="text-xs text-slate-600">Speak into your mic. Max 60 seconds.</p>
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition flex items-center space-x-2"
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>Stop Recording</span>
                      </button>
                    </div>
                  )}

                  {recordingState === 'recorded' && audioUrl && (
                    <div className="w-full max-w-md flex flex-col items-center space-y-3">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Captured ({formatTimer(recDuration)})</span>
                      </div>
                      <div className="w-full bg-white p-2 rounded-xl border border-slate-200">
                        <audio controls src={audioUrl} className="w-full" />
                      </div>
                      {!isLoading && (
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={handleDiscardRecording}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 transition flex items-center space-x-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Discard</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Progress bar when transcribing */}
              {isLoading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center space-x-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>{uploadProgress < 100 ? 'Uploading audio...' : 'Groq Whisper transcribing...'}</span>
                    </span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(uploadProgress, 15)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit CTA Button */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Guest files are processed instantly and <strong className="text-slate-700">never saved</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleSubmitDemo}
                  disabled={isLoading || (activeTab === 'upload' && !selectedFile) || (activeTab === 'record' && !recordedBlob)}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed shadow-sm transition flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Transcribing...</span>
                    </>
                  ) : (
                    <>
                      <span>Transcribe for free</span>
                      <ArrowRight className="w-4 h-4 text-indigo-300" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Small secondary trigger under card */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-xs text-slate-600 hover:text-indigo-600 underline font-medium transition"
              >
                or see a sample result
              </button>
            </div>
          </div>
        </section>

        {/* 4. Result Area (Inline below demo card) */}
        {demoResult && (
          <section ref={resultRef} className="pb-16 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
                {/* Result Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Transcribed
                    </span>

                    {demoResult.language && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Languages className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        {formatLanguageName(demoResult.language)}
                      </span>
                    )}

                    {demoResult.duration && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        {formatDuration(demoResult.duration)}
                      </span>
                    )}

                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {isSampleMode ? 'Sample Demo' : 'Guest Demo'}
                    </span>
                  </div>

                  {/* Actions: Copy & Download */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const contentToCopy = isSampleMode
                          ? sampleLangTab === 'original'
                            ? SAMPLE_TRANSCRIPT.originalText
                            : SAMPLE_TRANSCRIPT.translatedText
                          : demoResult.text;
                        handleCopy(contentToCopy);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center space-x-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const contentToDownload = isSampleMode
                          ? sampleLangTab === 'original'
                            ? SAMPLE_TRANSCRIPT.originalText
                            : SAMPLE_TRANSCRIPT.translatedText
                          : demoResult.text;
                        handleDownload(contentToDownload, `${demoResult.fileName || 'transcript'}.txt`);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.txt</span>
                    </button>
                  </div>
                </div>

                {/* Sample Result Mode with 2 Speakers and Translation switcher */}
                {isSampleMode ? (
                  <div className="space-y-4">
                    {/* Toggle: Original | English */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSampleLangTab('original')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                            sampleLangTab === 'original'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Original (Hindi)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSampleLangTab('en')}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                            sampleLangTab === 'en'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          English Translation
                        </button>
                      </div>

                      <div className="flex items-center space-x-1 text-xs text-slate-600">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>2 Speakers Detected</span>
                      </div>
                    </div>

                    {/* Chat-style Utterances */}
                    <div className="space-y-3 pt-2">
                      {SAMPLE_TRANSCRIPT.utterances.map((utt, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border ${
                            utt.speaker === 1
                              ? 'bg-indigo-50/60 border-indigo-200/80'
                              : 'bg-emerald-50/60 border-emerald-200/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-xs font-bold uppercase tracking-wider ${
                                utt.speaker === 1 ? 'text-indigo-800' : 'text-emerald-800'
                              }`}
                            >
                              Speaker {utt.speaker}
                            </span>
                            <span className="font-mono text-[11px] text-slate-600">
                              {formatTimestamp(utt.start)} - {formatTimestamp(utt.end)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-900 leading-relaxed">
                            {sampleLangTab === 'original' ? utt.originalText : utt.translatedText}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Standard Guest Transcript Display */
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-72 overflow-y-auto">
                    <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                      {demoResult.text}
                    </p>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setDemoResult(null);
                      setIsSampleMode(false);
                      setSelectedFile(null);
                      handleDiscardRecording();
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
                  >
                    Clear &amp; try another audio
                  </button>
                  <p className="text-[11px] text-slate-600">Processed via Groq Whisper Large v3</p>
                </div>
              </div>

              {/* Upgrade Callout Banner */}
              <div className="bg-gradient-to-r from-indigo-50 via-white to-indigo-50/60 rounded-2xl border border-indigo-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Unlock Speaker Detection &amp; Hindi/English Translation</span>
                  </h4>
                  <p className="text-xs text-slate-600">
                    Want speaker detection, English/Hindi translation and saved history? Create a free account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition flex-shrink-0 flex items-center justify-center space-x-1.5"
                >
                  <span>Create free account</span>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-300" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 5. How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-24 bg-white border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Workflow</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                How Audiqo works in three steps
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                A streamlined transcription pipeline built for accuracy, speed, and privacy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col space-y-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="text-base font-bold text-slate-900">Upload or record audio</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Upload any MP3, WAV, M4A, or WEBM audio file up to 25 MB (or 3 MB for guests), or record your voice directly using your browser's microphone.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col space-y-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="text-base font-bold text-slate-900">Transcribe in seconds</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Groq LPUs process your audio with Whisper Large v3 in near real-time, delivering high precision text across Hindi, English, and 50+ languages.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col space-y-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="text-base font-bold text-slate-900">Detect speakers &amp; translate</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Detect multiple speakers with AssemblyAI diarization and translate between English and Hindi while keeping timestamps and speakers aligned.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Features Grid Section */}
        <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Capabilities</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Everything you need for speech to text
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Built for students, interviewers, developers, and team meetings.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-slate-300 transition">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Whisper Large v3 Engine</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  State-of-the-art speech recognition with low latency via Groq LPU inference. Handles accents and background noise cleanly.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-slate-300 transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <Mic className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Microphone Recording</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Record live audio directly in your browser with real-time waveform timing, instant audio preview, and auto-stop safeguards.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-slate-300 transition">
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Speaker Diarization</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Identify who spoke when. Color-coded speaker tags, timestamps, and conversational bubbles powered by AssemblyAI.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-slate-300 transition">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <Languages className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">English &amp; Hindi Translation</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Translate transcripts between English and Hindi while preserving every speaker turn and utterance timing precisely.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-slate-300 transition">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Searchable History</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  All member transcripts are safely organized in MongoDB with instant full-text search, pagination, and deletion controls.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 hover:border-slate-300 transition">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Flexible Export</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Copy clean text with one click, or export UTF-8 formatted `.txt` files containing full speaker names and timestamps.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Comparison Table Section */}
        <section id="comparison" className="py-16 sm:py-24 bg-white border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Tiers</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Guest demo vs Free account
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Try Audiqo instantly as a guest, or create a free account to unlock all features.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="py-3.5 px-4 sm:px-6 font-semibold">Capability</th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold">Guest Demo</th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-indigo-700 bg-indigo-50/50">
                      Free Account
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">Maximum file size</td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600">3 MB</td>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900 bg-indigo-50/20">25 MB</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">Audio duration</td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600">Up to 60-90 seconds</td>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900 bg-indigo-50/20">Full length (up to 5m mic / 25MB)</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">Whisper transcription</td>
                    <td className="py-3.5 px-4 sm:px-6 text-emerald-600 font-semibold">&check; Whisper Large v3</td>
                    <td className="py-3.5 px-4 sm:px-6 text-emerald-600 font-semibold bg-indigo-50/20">&check; Whisper Large v3</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">Multi-speaker detection</td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600">&times; Not available</td>
                    <td className="py-3.5 px-4 sm:px-6 text-emerald-600 font-semibold bg-indigo-50/20">&check; AssemblyAI diarization</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">English &amp; Hindi translation</td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600">&times; Not available</td>
                    <td className="py-3.5 px-4 sm:px-6 text-emerald-600 font-semibold bg-indigo-50/20">&check; Aligned translation</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">Saved transcript history</td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600">&times; Deleted immediately</td>
                    <td className="py-3.5 px-4 sm:px-6 text-emerald-600 font-semibold bg-indigo-50/20">&check; Stored in MongoDB</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-4 sm:px-6 font-medium text-slate-900">Pricing</td>
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">Free</td>
                    <td className="py-3.5 px-4 sm:px-6 font-bold text-indigo-700 bg-indigo-50/20">Free forever</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition inline-flex items-center space-x-2"
              >
                <span>Get started for free</span>
                <ArrowRight className="w-4 h-4 text-indigo-300" />
              </button>
            </div>
          </div>
        </section>

        {/* 8. FAQ Section */}
        <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Questions</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Frequently asked questions
              </h2>
            </div>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full py-4 px-5 sm:px-6 text-left flex items-center justify-between space-x-3"
                    >
                      <span className="text-sm sm:text-base font-semibold text-slate-900">{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-600 transition-transform duration-200 flex-shrink-0 ${
                          isOpen ? 'rotate-180 text-slate-900' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 sm:px-6 pb-4 pt-1 text-xs sm:text-sm text-slate-600 border-t border-slate-100 leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 9. Final Call to Action Section */}
        <section className="py-16 bg-slate-900 text-white text-center px-4 sm:px-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Ready to transcribe your speech?
            </h2>
            <p className="text-slate-400 text-xs sm:text-base">
              Create an account in 30 seconds and transcribe, detect speakers, and translate your audio recordings for free.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 shadow-sm transition inline-flex items-center space-x-2"
              >
                <span>Create a free account</span>
                <ArrowRight className="w-4 h-4 text-indigo-600" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-600">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <AudioWaveform className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">Audiqo</span>
              <p className="text-[11px] text-slate-600">Speech to text engine</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 font-medium">
            <a href="#how-it-works" className="hover:text-slate-900 transition">How it works</a>
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
            <button type="button" onClick={() => navigate('/login')} className="hover:text-slate-900 transition">Log in</button>
            <button type="button" onClick={() => navigate('/register')} className="hover:text-slate-900 transition">Register</button>
          </div>

          <div className="text-center sm:text-right space-y-1">
            <p>&copy; {new Date().getFullYear()} Audiqo. All rights reserved.</p>
            <p className="text-[11px] text-slate-600">Built with React, Express, Groq Whisper &amp; AssemblyAI.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

