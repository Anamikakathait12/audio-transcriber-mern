import { useState, useEffect } from 'react';
import {
  Copy,
  Download,
  Check,
  Users,
  Clock,
  Globe,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  Languages,
} from 'lucide-react';
import { translateTranscript } from '../api/transcriptApi.js';

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
 * Format language code to human-readable language name (e.g. "en" -> "English", "hi" -> "Hindi")
 */
const formatLanguageName = (lang) => {
  if (!lang) return '';
  const l = String(lang).toLowerCase().trim();
  if (l === 'en' || l.startsWith('en_') || l.startsWith('en-') || l === 'english') return 'English';
  if (l === 'hi' || l.startsWith('hi_') || l.startsWith('hi-') || l === 'hindi') return 'Hindi';
  if (l === 'es' || l === 'spanish') return 'Spanish';
  if (l === 'fr' || l === 'french') return 'French';
  if (l === 'de' || l === 'german') return 'German';
  if (l === 'auto') return 'Auto-detected';
  return l.toUpperCase();
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
 * TranscriptResult Component
 * Displays transcription result, metadata, chat-style speaker diarization,
 * segmented language translation switcher (Original | English | हिन्दी), and UTF-8 copy/export.
 */
function TranscriptResult({ transcript, onClear }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('original'); // 'original' | 'en' | 'hi'
  const [translations, setTranslations] = useState(transcript?.translations || {});
  const [translatingLang, setTranslatingLang] = useState(null); // 'en' | 'hi' | null
  const [translateError, setTranslateError] = useState(null);

  // Sync state if transcript prop changes
  useEffect(() => {
    setTranslations(transcript?.translations || {});
    setActiveTab('original');
    setTranslateError(null);
  }, [transcript?._id, transcript?.translations]);

  if (!transcript) return null;

  const { text, language, duration, originalFileName, createdAt, segments, speakerCount } = transcript;
  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const detectedSpeakers = speakerCount || (hasSegments ? new Set(segments.map((s) => s.speaker)).size : 0);

  // Determine transcript language to conditionally hide redundant translation option
  const normLang = (language || '').toLowerCase().trim();
  const isEnglish = normLang === 'en' || normLang.startsWith('en_') || normLang.startsWith('en-') || normLang === 'english';
  const isHindi = normLang === 'hi' || normLang.startsWith('hi_') || normLang.startsWith('hi-') || normLang === 'hindi';

  const languageOptions = [
    { id: 'original', label: 'Original' },
    !isEnglish && { id: 'en', label: 'English' },
    !isHindi && { id: 'hi', label: 'हिन्दी' },
  ].filter(Boolean);

  /**
   * Handle switching between Original, English, and Hindi versions
   */
  const handleTabSwitch = async (targetId) => {
    setTranslateError(null);

    if (targetId === 'original') {
      setActiveTab('original');
      return;
    }

    // If cached in state, instant switch
    if (translations[targetId]?.text) {
      setActiveTab(targetId);
      return;
    }

    if (!transcript._id) {
      setTranslateError('Transcript record must be saved before translating.');
      return;
    }

    // Otherwise call backend Groq translation
    setTranslatingLang(targetId);
    try {
      const res = await translateTranscript(transcript._id, targetId);
      if (res && res.translation) {
        setTranslations((prev) => ({
          ...prev,
          [targetId]: res.translation,
        }));
        setActiveTab(targetId);
      }
    } catch (err) {
      console.error('Translation failed:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Translation request failed. Please try again.';
      setTranslateError(msg);
    } finally {
      setTranslatingLang(null);
    }
  };

  /**
   * Generate text to copy/download based on currently active view (Original, English, or Hindi)
   */
  const getActiveExportText = () => {
    if (activeTab === 'original') {
      if (hasSegments) {
        return segments.map((seg) => `Speaker ${seg.speaker}: ${seg.text}`).join('\n\n');
      }
      return text || '';
    }

    const currentTrans = translations[activeTab];
    if (!currentTrans) {
      return text || '';
    }

    if (hasSegments && Array.isArray(currentTrans.segments) && currentTrans.segments.length > 0) {
      return segments
        .map((seg, idx) => `Speaker ${seg.speaker}: ${currentTrans.segments[idx] || seg.text}`)
        .join('\n\n');
    }

    return currentTrans.text || text || '';
  };

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    const exportText = getActiveExportText();
    if (!exportText) return;

    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript to clipboard:', err);
    }
  };

  // Handle Download as .txt file with UTF-8 BOM and language suffix (e.g. name-en.txt)
  const handleDownload = () => {
    const exportText = getActiveExportText();
    if (!exportText) return;

    const blob = new Blob(['\uFEFF' + exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const baseName = originalFileName
      ? originalFileName.replace(/\.[^/.]+$/, '')
      : 'audiqo-transcript';
    const suffix = activeTab === 'original' ? '' : `-${activeTab}`;
    link.href = url;
    link.download = `${baseName}${suffix}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeTranslation = activeTab !== 'original' ? translations[activeTab] : null;

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

      {/* Metadata Badges & Segmented Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 pb-3">
        {/* Badges Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {language && (
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <Globe className="w-3.5 h-3.5 text-slate-600" />
              <span className="font-medium">{formatLanguageName(language)}</span>
            </div>
          )}

          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span>{formatDuration(duration)}</span>
          </div>

          {hasSegments && (
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-medium">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {detectedSpeakers} {detectedSpeakers === 1 ? 'Speaker' : 'Speakers'} Detected
              </span>
            </div>
          )}

          {createdAt && (
            <div className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>{new Date(createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Translation Segmented Switch */}
        <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto">
          <Languages className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 hidden sm:block" />
          {languageOptions.map((opt) => {
            const isActive = activeTab === opt.id;
            const isLoading = translatingLang === opt.id;
            const isCached = opt.id !== 'original' && Boolean(translations[opt.id]?.text);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTabSwitch(opt.id)}
                disabled={translatingLang !== null}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition duration-150 flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                } ${translatingLang !== null && !isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {isLoading && <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />}
                <span>{opt.label}</span>
                {isCached && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Cached translation" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Translation Error Alert */}
      {translateError && (
        <div className="mt-2 mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{translateError}</span>
          </div>
          <button
            type="button"
            onClick={() => setTranslateError(null)}
            className="text-rose-400 hover:text-rose-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Transcript Body: Speaker Segments or Plain Text */}
      <div className="mt-3">
        {hasSegments ? (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {segments.map((segment, index) => {
              const theme = getSpeakerTheme(segment.speaker);
              const bubbleText =
                activeTranslation && Array.isArray(activeTranslation.segments) && activeTranslation.segments[index]
                  ? activeTranslation.segments[index]
                  : segment.text;

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${theme.bubble} transition duration-150`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-6 h-6 rounded-md ${theme.avatar} text-xs font-bold flex items-center justify-center shadow-xs`}
                      >
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
                    {bubbleText}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 max-h-[360px] overflow-y-auto">
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
              {activeTranslation?.text || text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TranscriptResult;
