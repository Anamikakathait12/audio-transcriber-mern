import { useState, useEffect, useCallback } from 'react';
import { getTranscripts, deleteTranscript, translateTranscript } from '../api/transcriptApi.js';
import {
  Search,
  FileText,
  Clock,
  Globe,
  Calendar,
  Users,
  Copy,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  Inbox,
  Languages,
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
 * Format seconds into mm:ss timestamp
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
    avatar: 'bg-indigo-600 text-white',
    bubble: 'bg-indigo-50/70 border-indigo-200 text-slate-900',
  },
  {
    avatar: 'bg-emerald-600 text-white',
    bubble: 'bg-emerald-50/70 border-emerald-200 text-slate-900',
  },
  {
    avatar: 'bg-purple-600 text-white',
    bubble: 'bg-purple-50/70 border-purple-200 text-slate-900',
  },
  {
    avatar: 'bg-amber-600 text-white',
    bubble: 'bg-amber-50/70 border-amber-200 text-slate-900',
  },
  {
    avatar: 'bg-cyan-600 text-white',
    bubble: 'bg-cyan-50/70 border-cyan-200 text-slate-900',
  },
  {
    avatar: 'bg-rose-600 text-white',
    bubble: 'bg-rose-50/70 border-rose-200 text-slate-900',
  },
];

const getSpeakerTheme = (speakerNum) => {
  const index = (Math.max(1, Number(speakerNum) || 1) - 1) % SPEAKER_THEMES.length;
  return SPEAKER_THEMES[index];
};

/**
 * Format timestamp into readable date and time
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Generate formatted export text (including speaker labels if segments exist)
 * dynamically taking the active translation tab into account
 */
const getItemExportText = (item, activeTab = 'original') => {
  const hasSegments = Array.isArray(item.segments) && item.segments.length > 0;

  if (activeTab === 'original') {
    if (hasSegments) {
      return item.segments.map((seg) => `Speaker ${seg.speaker}: ${seg.text}`).join('\n\n');
    }
    return item.text || '';
  }

  const currentTrans = item.translations?.[activeTab];
  if (!currentTrans) {
    if (hasSegments) {
      return item.segments.map((seg) => `Speaker ${seg.speaker}: ${seg.text}`).join('\n\n');
    }
    return item.text || '';
  }

  if (hasSegments && Array.isArray(currentTrans.segments) && currentTrans.segments.length > 0) {
    return item.segments
      .map((seg, idx) => `Speaker ${seg.speaker}: ${currentTrans.segments[idx] || seg.text}`)
      .join('\n\n');
  }

  return currentTrans.text || item.text || '';
};

/**
 * HistoryList Component
 * Displays searchable, paginated transcription history with segmented translation switcher,
 * speaker badges & chat-style diarization view, copy/download actions, and deletion.
 */
function HistoryList({ refreshTrigger, onTranscriptDeleted, externalSearch, setExternalSearch }) {
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState(externalSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(externalSearch || '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Interaction States
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null); // ID pending confirmation
  const [isDeleting, setIsDeleting] = useState(false);

  // Step 9 Translation States for expanded items
  const [itemActiveTabs, setItemActiveTabs] = useState({}); // { [id]: 'original' | 'en' | 'hi' }
  const [translatingItem, setTranslatingItem] = useState(null); // { id, target }
  const [itemTranslateErrors, setItemTranslateErrors] = useState({}); // { [id]: string }

  // Sync external search term from Topbar if it changes
  useEffect(() => {
    if (externalSearch !== undefined && externalSearch !== searchTerm) {
      setSearchTerm(externalSearch);
    }
  }, [externalSearch]);

  // 400 ms debounce for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (setExternalSearch) setExternalSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search term
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  /**
   * Fetch paginated transcripts from API
   */
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTranscripts({
        search: debouncedSearch,
        page,
        limit: 6,
      });

      const list = response.transcripts || response.data || [];
      setTranscripts(list);
      setTotalPages(response.totalPages || 1);
      setTotalItems(response.total ?? list.length);
    } catch (err) {
      console.error('Failed to fetch transcript history:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to load transcript history.'
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  // Fetch on mount, search change, page change, or external refreshTrigger
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  /**
   * Toggle item expansion
   */
  const handleToggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (deletingId && deletingId !== id) {
      setDeletingId(null);
    }
  };

  /**
   * Handle switching between Original, English, and Hindi versions for an item
   */
  const handleHistoryTabSwitch = async (e, item, targetId) => {
    e.stopPropagation();
    setItemTranslateErrors((prev) => ({ ...prev, [item._id]: null }));

    if (targetId === 'original') {
      setItemActiveTabs((prev) => ({ ...prev, [item._id]: 'original' }));
      return;
    }

    // If already translated and cached, instant switch
    if (item.translations?.[targetId]?.text) {
      setItemActiveTabs((prev) => ({ ...prev, [item._id]: targetId }));
      return;
    }

    setTranslatingItem({ id: item._id, target: targetId });
    try {
      const res = await translateTranscript(item._id, targetId);
      if (res && res.translation) {
        // Update item in local list with cached translation
        setTranscripts((prevList) =>
          prevList.map((t) => {
            if (t._id === item._id) {
              return {
                ...t,
                translations: {
                  ...(t.translations || {}),
                  [targetId]: res.translation,
                },
              };
            }
            return t;
          })
        );
        setItemActiveTabs((prev) => ({ ...prev, [item._id]: targetId }));
      }
    } catch (err) {
      console.error('History item translation error:', err);
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to translate transcript.';
      setItemTranslateErrors((prev) => ({ ...prev, [item._id]: msg }));
    } finally {
      setTranslatingItem(null);
    }
  };

  /**
   * Copy transcript text to clipboard (matches currently active translation tab)
   */
  const handleCopy = async (e, item) => {
    e.stopPropagation();
    const activeTab = itemActiveTabs[item._id] || 'original';
    const exportText = getItemExportText(item, activeTab);
    if (!exportText) return;

    try {
      await navigator.clipboard.writeText(exportText);
      setCopiedId(item._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  /**
   * Download transcript as a UTF-8 encoded .txt file with language suffix
   */
  const handleDownload = (e, item) => {
    e.stopPropagation();
    const activeTab = itemActiveTabs[item._id] || 'original';
    const exportText = getItemExportText(item, activeTab);
    if (!exportText) return;

    // Prepended \uFEFF Byte Order Mark ensures Windows Notepad renders Hindi correctly
    const blob = new Blob(['\uFEFF' + exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanBaseName = item.originalFileName
      ? item.originalFileName.replace(/\.[^/.]+$/, '')
      : 'audiqo-transcript';
    const suffix = activeTab === 'original' ? '' : `-${activeTab}`;

    link.href = url;
    link.download = `${cleanBaseName}${suffix}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Confirm and execute transcript deletion
   */
  const handleConfirmDelete = async (e, id) => {
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteTranscript(id);
      setDeletingId(null);
      if (expandedId === id) setExpandedId(null);

      if (onTranscriptDeleted) onTranscriptDeleted(id);

      if (transcripts.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        fetchHistory();
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || 'Failed to delete transcript.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 transition-all duration-150">
      {/* Header & Local Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Transcription History
            </h2>
            {totalItems > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium border border-slate-200">
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Search, review, copy, translate, or download past audio transcriptions
          </p>
        </div>

        {/* Search input with clear button */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by keyword..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition duration-150"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800 text-xs p-1"
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center space-x-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 rounded-xl border border-slate-200 bg-slate-50 animate-pulse space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 rounded w-20"></div>
              </div>
              <div className="h-3 bg-slate-200 rounded w-4/5"></div>
              <div className="h-3 bg-slate-200 rounded w-2/5"></div>
            </div>
          ))}
        </div>
      ) : transcripts.length === 0 ? (
        /* Empty State */
        <div className="mt-8 py-12 px-4 text-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {debouncedSearch ? 'No matching transcripts found' : 'No transcripts yet'}
          </p>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
            {debouncedSearch
              ? `No transcripts match "${debouncedSearch}". Try a different keyword.`
              : 'Upload or record audio on the Transcribe tab to build your library.'}
          </p>
          {debouncedSearch && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        /* Transcripts List */
        <div className="mt-5 space-y-3">
          {transcripts.map((item) => {
            const isExpanded = expandedId === item._id;
            const isCopied = copiedId === item._id;
            const isPendingDelete = deletingId === item._id;
            const hasSegments = Array.isArray(item.segments) && item.segments.length > 0;
            const speakerCount =
              item.speakerCount || (hasSegments ? new Set(item.segments.map((s) => s.speaker)).size : 0);

            // Preview: first ~100 characters
            const rawText = item.text || (hasSegments ? item.segments.map((s) => s.text).join(' ') : '');
            const textPreview = rawText.length > 110 ? `${rawText.slice(0, 110).trim()}...` : rawText;

            // Check transcript language to hide redundant translation tab
            const normLang = (item.language || '').toLowerCase().trim();
            const isEnglish = normLang === 'en' || normLang.startsWith('en_') || normLang.startsWith('en-') || normLang === 'english';
            const isHindi = normLang === 'hi' || normLang.startsWith('hi_') || normLang.startsWith('hi-') || normLang === 'hindi';

            const languageOptions = [
              { id: 'original', label: 'Original' },
              !isEnglish && { id: 'en', label: 'English' },
              !isHindi && { id: 'hi', label: 'हिन्दी' },
            ].filter(Boolean);

            const activeTab = itemActiveTabs[item._id] || 'original';
            const currentTrans = activeTab !== 'original' ? item.translations?.[activeTab] : null;
            const isTranslatingThis = translatingItem && translatingItem.id === item._id;
            const itemError = itemTranslateErrors[item._id];

            // Badges for existing translations
            const hasEnglishTranslation = Boolean(item.translations?.en?.text);
            const hasHindiTranslation = Boolean(item.translations?.hi?.text);

            return (
              <div
                key={item._id}
                onClick={() => handleToggleExpand(item._id)}
                className={`rounded-xl border transition duration-150 cursor-pointer ${
                  isExpanded
                    ? 'border-indigo-300 bg-indigo-50/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      {/* File Name, Speaker Diarization Badge, and Translation Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-600 flex-shrink-0" />
                        <span className="font-semibold text-sm sm:text-base text-slate-900 truncate">
                          {item.originalFileName || 'Untitled Audio'}
                        </span>

                        {hasSegments && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Users className="w-3 h-3 text-indigo-600" />
                            <span>{speakerCount} {speakerCount === 1 ? 'speaker' : 'speakers'}</span>
                          </span>
                        )}

                        {/* Translation Available Badges */}
                        {hasEnglishTranslation && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                            title="English translation saved"
                          >
                            EN
                          </span>
                        )}
                        {hasHindiTranslation && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                            title="Hindi translation saved"
                          >
                            HI
                          </span>
                        )}
                      </div>

                      {/* Text Preview (when collapsed) */}
                      {!isExpanded && (
                        <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {textPreview || <span className="italic text-slate-600">No transcript text recorded.</span>}
                        </p>
                      )}

                      {/* Metadata Badges */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-600">
                        {item.language && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                            <Globe className="w-3 h-3 text-slate-600" />
                            <span className="font-medium text-slate-700">{formatLanguageName(item.language)}</span>
                          </span>
                        )}

                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>{formatDuration(item.duration)}</span>
                        </span>

                        {item.createdAt && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            <span>{formatDate(item.createdAt)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions & Chevron Button */}
                    <div className="flex items-center space-x-2 self-end sm:self-start pt-1 sm:pt-0">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, item)}
                        className={`p-1.5 rounded-lg border text-xs transition duration-150 ${
                          isCopied
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                        title="Copy transcript"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDownload(e, item)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition duration-150"
                        title="Download .txt"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Trigger */}
                      {isPendingDelete ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 rounded-lg p-1 animate-fadeIn"
                        >
                          <button
                            type="button"
                            onClick={(e) => handleConfirmDelete(e, item._id)}
                            disabled={isDeleting}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-700 transition"
                          >
                            {isDeleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(null);
                            }}
                            className="px-1.5 py-0.5 rounded text-[11px] text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(item._id);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs transition duration-150"
                          title="Delete transcript"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Expand / Collapse Toggle */}
                      <span className="p-1 text-slate-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-4 sm:p-5 pt-0 border-t border-slate-100 bg-slate-50/50 rounded-b-xl space-y-3"
                  >
                    {/* Translation Segmented Switch & Copy/Download Actions Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-3 pb-1">
                      {/* Segmented Switch */}
                      <div className="flex items-center space-x-1 p-1 bg-slate-200/70 rounded-xl border border-slate-200/80">
                        <Languages className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 hidden sm:block" />
                        {languageOptions.map((opt) => {
                          const isActive = activeTab === opt.id;
                          const isLoading =
                            isTranslatingThis && translatingItem.target === opt.id;
                          const isCached =
                            opt.id !== 'original' && Boolean(item.translations?.[opt.id]?.text);

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={(e) => handleHistoryTabSwitch(e, item, opt.id)}
                              disabled={isTranslatingThis}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition duration-150 flex items-center space-x-1.5 ${
                                isActive
                                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                              } ${isTranslatingThis && !isActive ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />}
                              <span>{opt.label}</span>
                              {isCached && !isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Translation cached" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Copy & Download Current View */}
                      <div className="flex items-center space-x-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, item)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center space-x-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownload(e, item)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center space-x-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download .txt</span>
                        </button>
                      </div>
                    </div>

                    {/* Translation Error Alert */}
                    {itemError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-fadeIn">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                          <span>{itemError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setItemTranslateErrors((prev) => ({ ...prev, [item._id]: null }))}
                          className="text-rose-400 hover:text-rose-600 font-bold ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Transcript Body (Segments or Plain Text) */}
                    {hasSegments ? (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {item.segments.map((segment, idx) => {
                          const theme = getSpeakerTheme(segment.speaker);
                          const bubbleText =
                            currentTrans && Array.isArray(currentTrans.segments) && currentTrans.segments[idx]
                              ? currentTrans.segments[idx]
                              : segment.text;

                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border ${theme.bubble}`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-5 h-5 rounded-md ${theme.avatar} text-[10px] font-bold flex items-center justify-center`}
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
                              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                                {bubbleText}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 max-h-[300px] overflow-y-auto">
                        <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {currentTrans?.text || item.text}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
          <div>
            Showing page <span className="font-semibold text-slate-900">{page}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span> ({totalItems} total)
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition duration-150 flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="px-2 font-mono font-medium text-slate-900">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition duration-150 flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryList;
