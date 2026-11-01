import { useState, useRef } from 'react';
import { UploadCloud, FileAudio, Check, AlertCircle, X, Users, Loader2 } from 'lucide-react';

// Max file size: 25 MB (matches Groq's & AssemblyAI's free limits)
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.oga', '.opus'];
const ALLOWED_MIME_PREFIXES = ['audio/'];

/**
 * Format raw byte size into readable string (e.g. 4.2 MB)
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * UploadBox Component
 * Light-theme drag-and-drop audio uploader with client-side validation, progress tracking,
 * speaker detection toggle, and transcription status indicator.
 */
function UploadBox({
  onUpload,
  isUploading,
  isTranscribing,
  uploadProgress,
  detectSpeakers: externalDetectSpeakers,
  setDetectSpeakers: externalSetDetectSpeakers,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalDetectSpeakers, setInternalDetectSpeakers] = useState(false);
  const [language, setLanguage] = useState('auto');
  const fileInputRef = useRef(null);

  // Allow external control if provided by parent (e.g., Quick Action Tile), otherwise internal
  const detectSpeakers = externalDetectSpeakers !== undefined ? externalDetectSpeakers : internalDetectSpeakers;
  const setDetectSpeakers = externalSetDetectSpeakers !== undefined ? externalSetDetectSpeakers : setInternalDetectSpeakers;

  /**
   * Validate audio file size and extension
   */
  const validateAudioFile = (file) => {
    if (!file) return 'Please choose an audio file.';

    const fileName = file.name || '';
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeValid =
      ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)) ||
      file.type === 'video/webm' ||
      file.type === 'application/ogg';

    if (!isExtensionValid && !isMimeValid) {
      return `Unsupported file format. Please upload an MP3, WAV, M4A, WEBM, OGG, OGA, or OPUS file.`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `File exceeds 25 MB limit (${formatFileSize(file.size)}). Please choose a smaller file.`;
    }

    return null;
  };

  /**
   * Handle incoming file from input selection or drag-drop
   */
  const handleFileSelect = (file) => {
    setValidationError('');
    if (!file) return;

    const error = validateAudioFile(file);
    if (error) {
      setValidationError(error);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading && !isTranscribing) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isUploading || isTranscribing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleBrowseClick = () => {
    if (!isUploading && !isTranscribing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile || isUploading || isTranscribing) return;
    onUpload(selectedFile, { detectSpeakers, language });
  };

  const isBusy = isUploading || isTranscribing;

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 transition-all duration-150">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.webm,.ogg,.oga,.opus,audio/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
        disabled={isBusy}
      />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        className={`relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition duration-150 ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-50/40 ring-4 ring-indigo-500/10'
            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
        } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {/* Upload Icon */}
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <UploadCloud className="w-6 h-6 text-indigo-300" />
          </div>

          <div>
            <p className="text-sm sm:text-base font-semibold text-slate-900">
              Drag and drop your audio file here, or{' '}
              <span className="text-indigo-600 hover:text-indigo-700 underline font-semibold">
                browse file
              </span>
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Supports MP3, WAV, M4A, WEBM, OGG, OGA, OPUS (up to 25 MB)
            </p>
          </div>
        </div>
      </div>

      {/* Client-side Validation Error */}
      {validationError && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center space-x-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Selected File Details Banner */}
      {selectedFile && !validationError && (
        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <FileAudio className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-600">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          {!isBusy && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-slate-600 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition duration-150"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Speaker Detection Toggle & Language Selection */}
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
                Identifies distinct speakers using AssemblyAI. Slower than standard Whisper.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            {/* Language Select */}
            <div className="flex items-center space-x-1.5">
              <label
                htmlFor="upload-language-select"
                className={`text-xs font-medium ${detectSpeakers ? 'text-slate-700' : 'text-slate-400'}`}
              >
                Language:
              </label>
              <select
                id="upload-language-select"
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
              onClick={() => setDetectSpeakers(!detectSpeakers)}
              disabled={isBusy}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                detectSpeakers ? 'bg-indigo-600' : 'bg-slate-200'
              } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                : `Uploading audio: ${uploadProgress}%`}
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
                  ? 'Detecting distinct voices and generating speech diarization...'
                  : 'Groq Whisper is generating high-accuracy transcription...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Transcribe Primary Button */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedFile || isBusy}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed shadow-sm transition duration-150 flex items-center justify-center space-x-2"
        >
          {isBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{isTranscribing ? 'Transcribing...' : 'Uploading...'}</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-indigo-300" />
              <span>
                {detectSpeakers ? 'Transcribe & Detect Speakers' : 'Transcribe Audio'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default UploadBox;
