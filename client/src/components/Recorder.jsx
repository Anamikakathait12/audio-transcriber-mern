import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Check, AlertCircle, Loader2, Users, Volume2 } from 'lucide-react';

// Maximum recording duration: 5 minutes (300 seconds) to stay well under 25 MB limit
const MAX_RECORDING_SECONDS = 300;

/**
 * Format raw seconds into mm:ss display
 */
const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Recorder Component
 * Light-theme live microphone recording with live timer, pulsing indicator, audio player preview,
 * speaker detection toggle, auto-stop safeguard, clean track release, and error handling.
 */
function Recorder({
  onUpload,
  isUploading,
  isTranscribing,
  uploadProgress,
  detectSpeakers: externalDetectSpeakers,
  setDetectSpeakers: externalSetDetectSpeakers,
  usage,
}) {
  // 'idle' | 'recording' | 'recorded'
  const [recordingState, setRecordingState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [internalDetectSpeakers, setInternalDetectSpeakers] = useState(false);
  const [language, setLanguage] = useState('auto');

  // Quota status
  const isDiarizationExhausted =
    usage?.remaining?.diarizations !== undefined && usage.remaining.diarizations <= 0;
  const isTranscriptionExhausted =
    usage?.remaining?.transcriptions !== undefined && usage.remaining.transcriptions <= 0;

  const detectSpeakers =
    !isDiarizationExhausted &&
    (externalDetectSpeakers !== undefined ? externalDetectSpeakers : internalDetectSpeakers);
  const setDetectSpeakers = externalSetDetectSpeakers !== undefined ? externalSetDetectSpeakers : setInternalDetectSpeakers;

  // Native Web Audio and timer refs
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const chunksRef = useRef([]);
  const audioUrlRef = useRef(null);

  // Keep audioUrlRef in sync for cleanup
  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  /**
   * Release all microphone hardware tracks so browser indicator turns off
   */
  const stopMediaTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping audio track:', e);
        }
      });
      streamRef.current = null;
    }
  };

  /**
   * Clean up timer, audio tracks, and object URLs on unmount
   */
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopMediaTracks();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  /**
   * Auto-stop recording when reaching MAX_RECORDING_SECONDS (5 minutes)
   */
  useEffect(() => {
    if (recordingState === 'recording' && duration >= MAX_RECORDING_SECONDS) {
      handleStopRecording();
    }
  }, [duration, recordingState]);

  /**
   * Start microphone recording
   */
  const handleStartRecording = async () => {
    setErrorMessage(null);

    // 1. Check browser feature support
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof window.MediaRecorder === 'undefined'
    ) {
      setErrorMessage(
        'Your browser does not support live microphone recording. Please use modern Chrome, Firefox, Safari, or Edge.'
      );
      return;
    }

    try {
      // 2. Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Determine best supported mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser use default
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        // Revoke prior object URL if any
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        const newUrl = URL.createObjectURL(finalBlob);
        setRecordedBlob(finalBlob);
        setAudioUrl(newUrl);
        setRecordingState('recorded');

        // Stop hardware mic tracks immediately
        stopMediaTracks();
      };

      recorder.start(250); // Collect data chunks every 250ms
      setDuration(0);
      setRecordingState('recording');

      // 4. Start live duration timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone recording error:', err);
      stopMediaTracks();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser settings and try again.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage(
          'No microphone device found. Please connect a working microphone and try again.'
        );
      } else {
        setErrorMessage(
          `Unable to access microphone: ${err.message || 'Unknown error occurred.'}`
        );
      }
    }
  };

  /**
   * Stop active recording
   */
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
      }
    }
  };

  /**
   * Discard current recording and reset to idle
   */
  const handleDiscardRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    stopMediaTracks();

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setRecordedBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setRecordingState('idle');
    setErrorMessage(null);
  };

  /**
   * Convert recording to a File object and submit for transcription
   */
  const handleTranscribeRecording = () => {
    if (!recordedBlob || isUploading || isTranscribing) return;

    const timestamp = Date.now();
    const fileName = `recording-${timestamp}.webm`;
    const audioFile = new File([recordedBlob], fileName, { type: 'audio/webm' });

    onUpload(audioFile, { detectSpeakers, language });
  };

  const isBusy = isUploading || isTranscribing;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 transition-all duration-150">
      {/* Microphone Permission / Browser Error Alert */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start space-x-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block">Microphone Notice</span>
            <p className="mt-0.5 text-rose-600">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-600 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recording Canvas */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 sm:p-8 flex flex-col items-center justify-center text-center">
        {/* State 1: Idle (Ready to record) */}
        {recordingState === 'idle' && (
          <div className="flex flex-col items-center space-y-4 max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Mic className="w-7 h-7 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Ready to Record
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Record your voice or audio directly. Max duration is 5 minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartRecording}
              disabled={isBusy}
              className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 shadow-sm transition duration-150 flex items-center space-x-2"
            >
              <Mic className="w-4 h-4 text-rose-400" />
              <span>Start Recording</span>
            </button>
          </div>
        )}

        {/* State 2: Live Recording */}
        {recordingState === 'recording' && (
          <div className="flex flex-col items-center space-y-5 animate-fadeIn">
            {/* Pulsing Red Dot & Timer */}
            <div className="flex items-center space-x-3 px-4 py-2 bg-rose-50 border border-rose-200 rounded-full">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                Recording live
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-base font-bold text-slate-900">
                {formatTimer(duration)}
              </span>
              <span className="text-xs text-slate-600 font-mono">/ 05:00</span>
            </div>

            <p className="text-xs text-slate-600">
              Speak clearly into your microphone. Click stop when finished.
            </p>

            {/* Stop Button */}
            <button
              type="button"
              onClick={handleStopRecording}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition duration-150 flex items-center space-x-2"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Stop Recording</span>
            </button>
          </div>
        )}

        {/* State 3: Recorded Preview */}
        {recordingState === 'recorded' && audioUrl && (
          <div className="w-full max-w-md flex flex-col items-center space-y-4 animate-fadeIn">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Audio Captured ({formatTimer(duration)})</span>
            </div>

            {/* Native Audio Preview Player */}
            <div className="w-full p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
              <audio controls src={audioUrl} className="w-full" />
            </div>

            {/* Action Buttons: Discard or Transcribe */}
            {!isBusy && (
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleDiscardRecording}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition duration-150 flex items-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4 text-slate-600" />
                  <span>Discard</span>
                </button>

                <button
                  type="button"
                  onClick={handleTranscribeRecording}
                  disabled={isTranscriptionExhausted}
                  title={isTranscriptionExhausted ? 'Daily transcription limit reached' : undefined}
                  className="px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed shadow-sm transition duration-150 flex items-center space-x-2"
                >
                  {isTranscriptionExhausted ? (
                    <span>Daily Limit Reached</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-indigo-300" />
                      <span>{detectSpeakers ? 'Transcribe & Detect Speakers' : 'Transcribe Recording'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Speaker Detection Toggle & Language Selection for Recordings */}
      <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-semibold text-slate-900 block">
                Detect speakers (Diarization)
              </span>
              <p className="text-[11px] sm:text-xs text-slate-600">
                Identify who said what with AssemblyAI.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            {/* Language Select */}
            <div className="flex items-center space-x-1.5">
              <label
                htmlFor="recorder-language-select"
                className={`text-xs font-medium ${detectSpeakers ? 'text-slate-700' : 'text-slate-400'}`}
              >
                Language:
              </label>
              <select
                id="recorder-language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={!detectSpeakers || isBusy}
                className={`text-xs py-1 px-2.5 rounded-lg border bg-white transition duration-150 focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                  detectSpeakers && !isBusy
                    ? 'border-slate-300 text-slate-800 cursor-pointer hover:border-slate-400'
                    : 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed opacity-60'
                }`}
              >
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={detectSpeakers}
              onClick={() => !isDiarizationExhausted && setDetectSpeakers(!detectSpeakers)}
              disabled={isBusy || isDiarizationExhausted}
              title={isDiarizationExhausted ? 'Daily speaker-detection limit reached' : undefined}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                detectSpeakers ? 'bg-indigo-600' : 'bg-slate-200'
              } ${isBusy || isDiarizationExhausted ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-150 ease-in-out ${
                  detectSpeakers ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Diarization quota warning */}
        {isDiarizationExhausted && (
          <p className="text-[11px] text-rose-600 font-medium pt-1 border-t border-slate-200/60 leading-relaxed">
            Daily speaker-detection limit reached. You can still transcribe audio without speaker detection.
          </p>
        )}

        {/* Mixed language helper text */}
        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
          Auto-detect picks one language for the whole file. For mixed Hindi-English speech, choose a language manually.
        </p>
      </div>

      {/* Upload & Transcription Progress Indicator */}
      {isBusy && (
        <div className="mt-5 space-y-2 animate-fadeIn">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-indigo-700">
              {isTranscribing
                ? detectSpeakers
                  ? 'Identifying speakers with AssemblyAI...'
                  : 'Transcribing with Whisper Large v3...'
                : `Uploading recording: ${uploadProgress}%`}
            </span>
            <span className="text-slate-600">
              {isTranscribing ? 'Processing...' : `${uploadProgress}%`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-200 ${
                isTranscribing
                  ? 'bg-gradient-to-r from-indigo-500 via-teal-500 to-indigo-600 animate-pulse w-full'
                  : 'bg-indigo-600'
              }`}
              style={{ width: isTranscribing ? '100%' : `${uploadProgress}%` }}
            />
          </div>

          {/* Transcribing Spinner State */}
          {isTranscribing && (
            <div className="flex items-center justify-center space-x-2 pt-2 text-xs sm:text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>
                {detectSpeakers
                  ? 'AssemblyAI is processing audio and detecting distinct speakers...'
                  : 'Groq Whisper is generating high-accuracy transcription...'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Recorder;
