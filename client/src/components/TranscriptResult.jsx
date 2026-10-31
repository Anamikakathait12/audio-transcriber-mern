import { useState } from 'react';
import { Copy, Download, Check, Users, Clock, Globe, Calendar, X, Sparkles } from 'lucide-react';

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
 * Light pastel color themes for speakers
 */
const SPEAKER_THEMES = [
  {
    name: 'Speaker 1',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    avatar: 'bg-indigo-600 text-white',
    bubble: 'bg-indigo-50/70 border-indigo-200 text-slate-900',
  },
  {
    name: 'Speaker 2',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    avatar: 'bg-emerald-600 text-white',
    bubble: 'bg-emerald-50/70 border-emerald-200 text-slate-900',
  },
  {
    name: 'Speaker 3',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    avatar: 'bg-purple-600 text-white',
    bubble: 'bg-purple-50/70 border-purple-200 text-slate-900',
  },
  {
    name: 'Speaker 4',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    avatar: 'bg-amber-600 text-white',
    bubble: 'bg-amber-50/70 border-amber-200 text-slate-900',
  },
  {
    name: 'Speaker 5',
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    avatar: 'bg-cyan-600 text-white',
    bubble: 'bg-cyan-50/70 border-cyan-200 text-slate-900',
  },
  {
    name: 'Speaker 6',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    avatar: 'bg-rose-600 text-white',
    bubble: 'bg-rose-50/70 border-rose-200 text-slate-900',
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
 * chat-style speaker diarization view, and UTF-8 copy/export in clean light theme.
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

    const baseName = originalFileName
      ? originalFileName.replace(/\.[^/.]+$/, '')
      : 'transcript';
    link.href = url;
    link.download = `${baseName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 transition-all duration-150 animate-fadeIn">
      {/* Result Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Transcription Complete
            </span>
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Check className="w-3 h-3" />
              <span>Ready</span>
            </span>
          </div>
          {originalFileName && (
            <p className="text-xs text-slate-600 mt-1 truncate max-w-md">
              File: <span className="font-medium text-slate-800">{originalFileName}</span>
            </p>
          )}
        </div>

        {/* Action Buttons: Copy, Download & Close */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition duration-150 flex items-center space-x-1.5 ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
            }`}
            title="Copy text"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition duration-150 flex items-center space-x-1.5"
            title="Download .txt"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download .txt</span>
          </button>

          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition duration-150"
              title="Close result"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Badges Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-4 pb-4">
        {language && (
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <Globe className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-medium uppercase">{language}</span>
          </div>
        )}

        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span>{formatDuration(duration)}</span>
        </div>

        {hasSegments && (
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-medium">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>{detectedSpeakers} {detectedSpeakers === 1 ? 'Speaker' : 'Speakers'} Detected</span>
          </div>
        )}

        {createdAt && (
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 ml-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span>{new Date(createdAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Transcript Body: Speaker Segments or Plain Text */}
      <div className="mt-2">
        {hasSegments ? (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {segments.map((segment, index) => {
              const theme = getSpeakerTheme(segment.speaker);
              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${theme.bubble} transition duration-150`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-md ${theme.avatar} text-xs font-bold flex items-center justify-center shadow-xs`}>
                        {segment.speaker}
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        Speaker {segment.speaker}
                      </span>
                    </div>

                    {(segment.start !== undefined || segment.end !== undefined) && (
                      <span className="text-[11px] font-mono text-slate-600">
                        {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                    {segment.text}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 max-h-[360px] overflow-y-auto">
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TranscriptResult;
