import { useState, useEffect, useCallback } from 'react';
import { getTranscripts, deleteTranscript } from '../api/transcriptApi.js';

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
 * Color palettes for speakers (matches TranscriptResult)
 */
const SPEAKER_THEMES = [
  {
    avatar: 'bg-indigo-600 text-white',
    bubble: 'bg-indigo-950/40 border-indigo-800/60 text-indigo-100',
  },
  {
    avatar: 'bg-emerald-600 text-white',
    bubble: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100',
  },
  {
    avatar: 'bg-purple-600 text-white',
    bubble: 'bg-purple-950/40 border-purple-800/60 text-purple-100',
  },
  {
    avatar: 'bg-amber-600 text-white',
    bubble: 'bg-amber-950/40 border-amber-800/60 text-amber-100',
  },
  {
    avatar: 'bg-cyan-600 text-white',
    bubble: 'bg-cyan-950/40 border-cyan-800/60 text-cyan-100',
  },
  {
    avatar: 'bg-rose-600 text-white',
    bubble: 'bg-rose-950/40 border-rose-800/60 text-rose-100',
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
 */
const getFormattedItemText = (item) => {
  if (item.segments && item.segments.length > 0) {
    return item.segments
      .map((seg) => `Speaker ${seg.speaker}: ${seg.text}`)
      .join('\n\n');
  }
  return item.text || '';
};

/**
 * HistoryList Component
 * Displays searchable, paginated transcription history with expandable items,
 * speaker badges & chat-style diarization view, copy/download actions, and deletion.
 */
function HistoryList({ refreshTrigger, onTranscriptDeleted }) {
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Interaction States
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null); // ID pending confirmation
  const [isDeleting, setIsDeleting] = useState(false);

  // 400 ms debounce for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
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
        limit: 5,
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
   * Copy transcript text to clipboard (including speaker labels if diarized)
   */
  const handleCopy = async (e, item) => {
    e.stopPropagation();
    const exportText = getFormattedItemText(item);
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
   * Download transcript as a UTF-8 encoded .txt file (with BOM for Hindi / Devanagari fidelity)
   */
  const handleDownload = (e, item) => {
    e.stopPropagation();
    const exportText = getFormattedItemText(item);
    if (!exportText) return;

    // Prepended \uFEFF Byte Order Mark ensures Windows Notepad renders Hindi and non-Latin scripts correctly
    const blob = new Blob(['\uFEFF' + exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanBaseName = item.originalFileName
      ? item.originalFileName.replace(/\.[^/.]+$/, '')
      : 'audio-transcript';

    link.href = url;
    link.download = `${cleanBaseName}.txt`;
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
    <div className="w-full bg-slate-800 rounded-2xl border border-slate-700/80 shadow-xl p-6 sm:p-8 mt-8">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-700">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📜 Transcript History</span>
            {totalItems > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
                {totalItems} {totalItems === 1 ? 'record' : 'records'}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search, review, copy, or download past audio transcriptions
          </p>
        </div>

        {/* Search Input Box */}
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search keyword or filename..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-900/90 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-200"
              title="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchHistory}
            className="px-3 py-1 text-xs bg-rose-900/80 hover:bg-rose-800 rounded-lg text-white font-medium transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="mt-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-slate-900/40 border border-slate-700/50 animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-700 rounded w-1/3"></div>
                <div className="h-4 bg-slate-700 rounded w-20"></div>
              </div>
              <div className="h-3 bg-slate-700/60 rounded w-full"></div>
              <div className="h-3 bg-slate-700/60 rounded w-4/5"></div>
              <div className="flex gap-2 pt-1">
                <div className="h-5 bg-slate-800 rounded-md w-16"></div>
                <div className="h-5 bg-slate-800 rounded-md w-16"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && transcripts.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="w-12 h-12 rounded-full bg-slate-700/40 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-200">
            {debouncedSearch ? 'No matching transcripts found' : 'No transcripts yet'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {debouncedSearch
              ? `No results match "${debouncedSearch}". Try a different keyword or filename.`
              : 'Upload and transcribe an audio file above to start building your history.'}
          </p>
        </div>
      )}

      {/* Transcript Items List */}
      {!loading && !error && transcripts.length > 0 && (
        <div className="mt-6 space-y-3">
          {transcripts.map((item) => {
            const isExpanded = expandedId === item._id;
            const isPendingDelete = deletingId === item._id;
            const hasSegments = Array.isArray(item.segments) && item.segments.length > 0;
            const detectedSpeakers = item.speakerCount || (hasSegments ? new Set(item.segments.map((s) => s.speaker)).size : 0);

            const textPreview = item.text
              ? item.text.length > 100
                ? `${item.text.slice(0, 100).trim()}...`
                : item.text
              : '';

            return (
              <div
                key={item._id}
                onClick={() => handleToggleExpand(item._id)}
                className={`p-5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isExpanded
                    ? 'bg-slate-900/90 border-indigo-500/60 shadow-lg'
                    : 'bg-slate-900/40 hover:bg-slate-900/70 border-slate-700/70'
                }`}
              >
                {/* Header Row: Filename, Meta & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="font-semibold text-sm text-slate-100 truncate">
                      {item.originalFileName || 'Untitled Audio'}
                    </span>

                    {/* Step 6: Small Speaker Count Badge */}
                    {hasSegments && detectedSpeakers > 0 && (
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1 flex-shrink-0">
                        <span>👥</span>
                        <span>{detectedSpeakers} {detectedSpeakers === 1 ? 'speaker' : 'speakers'}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-slate-400 flex-shrink-0">
                    <span>{formatDate(item.createdAt)}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transform transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-indigo-400' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Collapsed Preview: ~100 chars (preserves Hindi & Unicode characters) */}
                {!isExpanded && (
                  <p className="mt-2.5 text-xs text-slate-300 leading-relaxed break-words font-sans selection:bg-indigo-500">
                    {textPreview}
                  </p>
                )}

                {/* Expanded Full View */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-fadeIn">
                    {/* Chat-style Segments OR Full Plain Text Box */}
                    {hasSegments ? (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {item.segments.map((seg, sIdx) => {
                          const theme = getSpeakerTheme(seg.speaker);
                          return (
                            <div
                              key={sIdx}
                              className={`p-3.5 rounded-xl border ${theme.bubble}`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${theme.avatar}`}
                                  >
                                    S{seg.speaker}
                                  </div>
                                  <span className="text-xs font-bold text-white">
                                    Speaker {seg.speaker}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                                  {formatTimestamp(seg.start)} - {formatTimestamp(seg.end)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap break-words pl-7 selection:bg-indigo-500">
                                {seg.text}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-100 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans break-words max-h-80 overflow-y-auto selection:bg-indigo-500 selection:text-white">
                        {item.text}
                      </div>
                    )}

                    {/* Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {/* Left: Copy & Download buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, item)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center space-x-1.5 ${
                            copiedId === item._id
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                          }`}
                          title="Copy text with speaker labels"
                        >
                          {copiedId === item._id ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDownload(e, item)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all flex items-center space-x-1.5"
                          title="Download UTF-8 .txt with speaker labels"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download .txt</span>
                        </button>
                      </div>

                      {/* Right: Delete button with inline confirmation */}
                      <div>
                        {isPendingDelete ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center space-x-2 bg-rose-950/70 border border-rose-800/80 px-2.5 py-1 rounded-lg"
                          >
                            <span className="text-xs text-rose-300 font-medium">Delete transcript?</span>
                            <button
                              type="button"
                              onClick={(e) => handleConfirmDelete(e, item._id)}
                              disabled={isDeleting}
                              className="px-2 py-0.5 text-xs bg-rose-600 hover:bg-rose-500 text-white rounded font-semibold transition"
                            >
                              {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(null);
                              }}
                              className="px-2 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
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
                            className="px-2.5 py-1.5 text-xs rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition flex items-center space-x-1"
                            title="Delete transcript"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata Pills Footer */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/60">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-medium text-indigo-300 capitalize">
                    {item.language || 'Auto'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-medium text-purple-300">
                    {formatDuration(item.duration)}
                  </span>
                  {item.fileSize && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-medium text-slate-400">
                      {(item.fileSize / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-700 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="px-3.5 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition font-medium flex items-center space-x-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Previous</span>
          </button>

          <span className="text-slate-400 font-medium">
            Page <span className="text-slate-200 font-bold">{page}</span> of{' '}
            <span className="text-slate-200 font-bold">{totalPages}</span>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="px-3.5 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition font-medium flex items-center space-x-1"
          >
            <span>Next</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default HistoryList;
