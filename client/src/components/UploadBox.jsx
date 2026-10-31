import { useState, useRef } from 'react';

// Max file size: 25 MB (matches Groq's API restriction)
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
 * Drag-and-drop audio uploader with client-side validation, progress tracking,
 * and transcription status indicator.
 */
function UploadBox({ onUpload, isUploading, isTranscribing, uploadProgress }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  /**
   * Validate audio file size and extension
   */
  const validateAudioFile = (file) => {
    if (!file) return 'Please choose an audio file.';

    const fileName = file.name || '';
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    const isExtensionValid = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeValid = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix)) ||
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
    onUpload(selectedFile);
  };

  const isBusy = isUploading || isTranscribing;

  return (
    <div className="w-full bg-slate-800 rounded-2xl border border-slate-700/80 shadow-lg p-6 sm:p-8">
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
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-indigo-400 bg-indigo-950/30 ring-4 ring-indigo-500/20'
            : 'border-slate-600 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900/60'
        } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          {/* Upload Audio Icon */}
          <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-base font-medium text-slate-200">
              Drag and drop your audio file here, or{' '}
              <span className="text-indigo-400 hover:text-indigo-300 underline font-semibold">
                browse files
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports MP3, WAV, M4A, WEBM, OGG, OGA, OPUS (Max 25 MB)
            </p>
          </div>
        </div>
      </div>

      {/* Client-side Validation Error */}
      {validationError && (
        <div className="mt-4 p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-sm flex items-center space-x-2">
          <svg className="w-5 h-5 flex-shrink-0 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{validationError}</span>
        </div>
      )}

      {/* Selected File Details Banner */}
      {selectedFile && !validationError && (
        <div className="mt-5 p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <div className="truncate">
              <p className="text-sm font-medium text-slate-100 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-slate-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>

          {!isBusy && (
            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
              title="Remove file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Upload & Transcription Progress Indicator */}
      {isBusy && (
        <div className="mt-5 space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-indigo-300">
              {isTranscribing ? 'Transcribing with Whisper AI...' : `Uploading audio: ${uploadProgress}%`}
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

          {/* Transcribing Spinner State */}
          {isTranscribing && (
            <div className="flex items-center justify-center space-x-2 pt-2 text-sm text-purple-300">
              <svg className="animate-spin h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Groq Whisper is transcribing your audio...</span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedFile || isBusy}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2"
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
              <span>Transcribe Audio</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default UploadBox;
