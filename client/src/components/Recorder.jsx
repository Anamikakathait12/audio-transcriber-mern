import { useState, useRef, useEffect } from 'react';

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
 * Live microphone recording with live timer, pulsing indicator, audio player preview,
 * auto-stop safeguard, clean track release, and error handling.
 */
function Recorder({ onUpload, isUploading, isTranscribing, uploadProgress }) {
  // 'idle' | 'recording' | 'recorded'
  const [recordingState, setRecordingState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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
          'Microphone permission was denied. Please allow microphone access in your browser site settings and try again.'
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

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  /**
   * Discard current recording and reset back to idle
   */
  const handleDiscardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordedBlob(null);
    setDuration(0);
    setRecordingState('idle');
    setErrorMessage(null);
  };

  /**
   * Convert blob to File and pass to parent transcription handler
   */
  const handleTranscribeRecording = () => {
    if (!recordedBlob || isUploading || isTranscribing) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `recording-${timestamp}.webm`;

    // Package Blob into standard Web File object
    const file = new File([recordedBlob], fileName, {
      type: 'audio/webm',
      lastModified: Date.now(),
    });

    onUpload(file);
  };

  const isBusy = isUploading || isTranscribing;

  return (
    <div className="w-full bg-slate-800 rounded-2xl border border-slate-700/80 shadow-lg p-6 sm:p-8">
      {/* Error Alert Box */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-sm flex items-start space-x-3">
          <svg
            className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Recording Error</span>
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200"
            title="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* STATE 1: IDLE STATE */}
      {recordingState === 'idle' && (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Record from Microphone
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Click Start to begin speaking. Recording automatically limits to 5 minutes to stay within limits.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartRecording}
            className="px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/30 hover:shadow-rose-900/50 transition-all flex items-center space-x-2"
          >
            <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <span>Start Recording</span>
          </button>
        </div>
      )}

      {/* STATE 2: ACTIVE RECORDING STATE */}
      {recordingState === 'recording' && (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-5 animate-fadeIn">
          {/* Pulsing Red Dot and Mic Graphic */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 border border-rose-500/30 animate-pulse">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <span className="absolute top-1 right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" />
            </span>
          </div>

          {/* Live Timer (mm:ss) */}
          <div>
            <div className="text-3xl font-mono font-bold text-white tracking-wider">
              {formatTimer(duration)}
            </div>
            <p className="text-xs text-rose-400 font-medium mt-1 flex items-center justify-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Recording live audio...</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Max duration: 05:00
            </p>
          </div>

          {/* Stop Button */}
          <button
            type="button"
            onClick={handleStopRecording}
            className="px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 shadow-md transition-all flex items-center space-x-2"
          >
            <span className="w-3 h-3 rounded-sm bg-rose-500" />
            <span>Stop Recording</span>
          </button>
        </div>
      )}

      {/* STATE 3: RECORDED PREVIEW & ACTION */}
      {recordingState === 'recorded' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h4 className="text-sm font-semibold text-white">Recording Preview</h4>
            </div>
            <span className="text-xs font-mono text-purple-300 font-medium">
              Duration: {formatTimer(duration)}
            </span>
          </div>

          {/* HTML5 Audio Player */}
          {audioUrl && (
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700">
              <audio
                controls
                src={audioUrl}
                className="w-full h-10 focus:outline-none"
              />
            </div>
          )}

          {/* Upload & Transcription Progress Bar (During transcription) */}
          {isBusy && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-indigo-300">
                  {isTranscribing ? 'Transcribing with Whisper AI...' : `Uploading recording: ${uploadProgress}%`}
                </span>
                <span className="text-slate-400">
                  {isTranscribing ? 'Processing...' : `${uploadProgress}%`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    isTranscribing
                      ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse w-full'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: isTranscribing ? '100%' : `${uploadProgress}%` }}
                />
              </div>

              {isTranscribing && (
                <div className="flex items-center justify-center space-x-2 pt-1 text-sm text-purple-300">
                  <svg className="animate-spin h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Groq Whisper is transcribing your recording...</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons: Discard and Transcribe */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleDiscardRecording}
              disabled={isBusy}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-700/80 hover:bg-slate-700 disabled:opacity-50 transition"
            >
              Discard & Re-record
            </button>

            <button
              type="button"
              onClick={handleTranscribeRecording}
              disabled={isBusy}
              className="w-full sm:w-auto px-6 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md hover:shadow-indigo-500/20 transition flex items-center justify-center space-x-2"
            >
              {isBusy ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{isTranscribing ? 'Transcribing...' : 'Uploading...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span>Transcribe Recording</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Recorder;

