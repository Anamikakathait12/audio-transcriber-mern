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
 * Format timestamp in seconds to mm:ss format
 */
const formatTimestamp = (seconds) => {
  if (seconds === undefined || seconds === null) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Color palettes for speakers (supports up to 6 distinct speaker themes with cyclic fallback)
 */
const SPEAKER_THEMES = [
  {
    name: 'Speaker 1',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    avatar: 'bg-indigo-600 text-white',
    bubble: 'bg-indigo-950/40 border-indigo-800/60 text-indigo-100',
  },
  {
    name: 'Speaker 2',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    avatar: 'bg-emerald-600 text-white',
    bubble: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100',
  },
  {
    name: 'Speaker 3',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    avatar: 'bg-purple-600 text-white',
    bubble: 'bg-purple-950/40 border-purple-800/60 text-purple-100',
  },
  {
    name: 'Speaker 4',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    avatar: 'bg-amber-600 text-white',
    bubble: 'bg-amber-950/40 border-amber-800/60 text-amber-100',
  },
  {
    name: 'Speaker 5',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    avatar: 'bg-cyan-600 text-white',
    bubble: 'bg-cyan-950/40 border-cyan-800/60 text-cyan-100',
  },
  {
    name: 'Speaker 6',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    avatar: 'bg-rose-600 text-white',
    bubble: 'bg-rose-950/40 border-rose-800/60 text-rose-100',
  },
];

const getSpeakerTheme = (speakerNum) => {
  const index = (Math.max(1, Number(speakerNum) || 1) - 1) % SPEAKER_THEMES.length;
  return SPEAKER_THEMES[index];
};

/**
 * Generate formatted export text (including speaker labels if segments exist)
 */
const getFormattedExportText = (transcript) => {
  if (transcript.segments && transcript.segments.length > 0) {
    return transcript.segments
      .map((seg) => `Speaker ${seg.speaker}: ${seg.text}`)
      .join('\n\n');
  }
  return transcript.text || '';
};

/**
 * TranscriptResult Component
 * Displays transcription result, metadata (language, duration),
 * chat-style speaker diarization view, and UTF-8 copy/export.
 */
function TranscriptResult({ transcript, onClear }) {
  const [copied, setCopied] = useState(false);

  if (!transcript) return null;

  const { text, language, duration, originalFileName, createdAt, segments, speakerCount } = transcript;
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const detectedSpeakers = speakerCount || (hasSegments ? new Set(segments.map((s) => s.speaker)).size : 0);

  // Handle Copy to Clipboard (including speaker labels if available)
  const handleCopy = async () => {
    const exportText = getFormattedExportText(transcript);
    if (!exportText) return;

    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript to clipboard:', err);
    }
  };

  // Handle Download as .txt file (with UTF-8 BOM so Hindi and non-Latin scripts open cleanly)
  const handleDownload = () => {
    const exportText = getFormattedExportText(transcript);
    if (!exportText) return;

    const blob = new Blob(['\uFEFF' + exportText], { type: 'text/plain;charset=utf-8' });
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white">Transcription Result</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Completed
            </span>

            {/* Step 6 Speaker Detection Badge */}
            {hasSegments && detectedSpeakers > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>👥</span>
                <span>{detectedSpeakers} {detectedSpeakers === 1 ? 'speaker' : 'speakers'} detected</span>
              </span>
            )}
          </div>

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
            title="Copy text with speaker labels"
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

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-600 bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-all flex items-center space-x-1.5"
            title="Download UTF-8 formatted .txt"
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

      {/* STEP 6: Chat-style View (When speaker segments exist) OR Plain Text Box */}
      {hasSegments ? (
        <div className="mt-3 space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
          {segments.map((seg, idx) => {
            const theme = getSpeakerTheme(seg.speaker);
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border ${theme.bubble} transition-all`}
              >
                {/* Speaker Header with Avatar, Name, and Timestamp */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${theme.avatar}`}
                    >
                      S{seg.speaker}
                    </div>
                    <span className="text-xs font-bold text-white">
                      Speaker {seg.speaker}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                    {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                  </span>
                </div>

                {/* Speaker Utterance Text (preserves Hindi & Unicode) */}
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap break-words pl-8 selection:bg-indigo-500 selection:text-white">
                  {seg.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        /* Regular Single-Speaker Plain Text Box */
        <div className="mt-2 p-5 rounded-xl bg-slate-900/90 border border-slate-700/70 text-slate-100 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm selection:bg-indigo-500 selection:text-white">
          {text}
        </div>
      )}
    </div>
  );
}

export default TranscriptResult;
