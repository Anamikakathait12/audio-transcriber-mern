import { useState } from 'react';

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
 * TranscriptResult Component
 * Displays transcription result, metadata (language, duration),
 * with copy-to-clipboard and export-to-.txt capabilities.
 */
function TranscriptResult({ transcript, onClear }) {
  const [copied, setCopied] = useState(false);

  if (!transcript) return null;

  const { text, language, duration, originalFileName, createdAt } = transcript;

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript to clipboard:', err);
    }
  };

  // Handle Download as .txt file
  const handleDownload = () => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanBaseName = originalFileName
      ? originalFileName.replace(/\.[^/.]+$/, '')
      : 'audio-transcript';

    link.href = url;
    link.download = `${cleanBaseName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="w-full bg-slate-800 rounded-2xl border border-slate-700/80 shadow-xl p-6 sm:p-8 mt-8 animate-fadeIn">
      {/* Header & Meta Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-700">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Transcription Result</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Completed
            </span>
          </h2>
          {originalFileName && (
            <p className="text-xs text-slate-400 mt-1 truncate max-w-sm sm:max-w-md">
              Source file: <span className="text-slate-300 font-medium">{originalFileName}</span>
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center space-x-1.5 ${
              copied
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-slate-700/80 hover:bg-slate-700 border-slate-600 text-slate-200 hover:text-white'
            }`}
            title="Copy text to clipboard"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Download .txt Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-600 bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all flex items-center space-x-1.5"
            title="Download as .txt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Download .txt</span>
          </button>

          {/* Clear / Dismiss Button */}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-2 text-xs rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
              title="Clear transcript"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Metadata Pill Bar */}
      <div className="flex flex-wrap items-center gap-3 py-3 text-xs text-slate-300">
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-slate-900/60 border border-slate-700/60">
          <span className="text-slate-400 font-medium">Language:</span>
          <span className="capitalize font-semibold text-indigo-300">{language || 'Auto'}</span>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-slate-900/60 border border-slate-700/60">
          <span className="text-slate-400 font-medium">Duration:</span>
          <span className="font-semibold text-purple-300">{formatDuration(duration)}</span>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-slate-900/60 border border-slate-700/60">
          <span className="text-slate-400 font-medium">Word Count:</span>
          <span className="font-semibold text-slate-200">{wordCount}</span>
        </div>

        {createdAt && (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-slate-900/60 border border-slate-700/60 ml-auto">
            <span className="text-slate-400 font-medium">Timestamp:</span>
            <span className="font-medium text-slate-300">{new Date(createdAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Transcript Text Box */}
      <div className="mt-2 p-5 rounded-xl bg-slate-900/90 border border-slate-700/70 text-slate-100 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm selection:bg-indigo-500 selection:text-white">
        {text}
      </div>
    </div>
  );
}

export default TranscriptResult;

