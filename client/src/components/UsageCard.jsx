import { Activity, Clock } from 'lucide-react';

/**
 * UsageCard Component
 * Displays today's consumption progress bars for registered users:
 * Transcriptions, Speaker detections, and Translations.
 */
function UsageCard({ usage, compact = false }) {
  if (!usage) {
    return null;
  }

  const limits = usage.limits || { transcriptions: 20, diarizations: 5, translations: 30 };
  const used = usage.used || { transcriptions: 0, diarizations: 0, translations: 0 };
  const remaining = usage.remaining || {
    transcriptions: Math.max(0, limits.transcriptions - used.transcriptions),
    diarizations: Math.max(0, limits.diarizations - used.diarizations),
    translations: Math.max(0, limits.translations - used.translations),
  };

  const getPercentage = (u, lim) => {
    if (!lim || lim <= 0) return 0;
    return Math.min(100, Math.round((u / lim) * 100));
  };

  const items = [
    {
      id: 'transcriptions',
      label: 'Transcriptions',
      used: used.transcriptions,
      limit: limits.transcriptions,
      remaining: remaining.transcriptions,
      color: remaining.transcriptions === 0 ? 'bg-rose-500' : 'bg-slate-900',
    },
    {
      id: 'diarizations',
      label: 'Speaker detection',
      used: used.diarizations,
      limit: limits.diarizations,
      remaining: remaining.diarizations,
      color: remaining.diarizations === 0 ? 'bg-rose-500' : 'bg-indigo-600',
    },
    {
      id: 'translations',
      label: 'Translations',
      used: used.translations,
      limit: limits.translations,
      remaining: remaining.translations,
      color: remaining.translations === 0 ? 'bg-rose-500' : 'bg-emerald-600',
    },
  ];

  if (compact) {
    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>Today's usage</span>
          </div>
          <span className="text-[10px] font-normal text-slate-600 flex items-center space-x-1">
            <Clock className="w-3 h-3 text-slate-600" />
            <span>Resets at 00:00 UTC</span>
          </span>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const pct = getPercentage(item.used, item.limit);
            const isExhausted = item.remaining === 0;

            return (
              <div key={item.id} className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className={`font-medium ${isExhausted ? 'text-rose-600' : 'text-slate-600'}`}>
                    {item.label}
                  </span>
                  <span className={`font-mono ${isExhausted ? 'text-rose-600 font-semibold' : 'text-slate-700'}`}>
                    {item.used} / {item.limit}
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${item.color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-100 gap-1.5">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Today's usage</h3>
        </div>
        <div className="flex items-center space-x-1 text-xs text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-600" />
          <span>Resets at 00:00 UTC</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {items.map((item) => {
          const pct = getPercentage(item.used, item.limit);
          const isExhausted = item.remaining === 0;

          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border ${
                isExhausted
                  ? 'bg-rose-50/50 border-rose-200'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={`font-semibold ${isExhausted ? 'text-rose-700' : 'text-slate-800'}`}>
                  {item.label}
                </span>
                <span className={`font-mono text-xs ${isExhausted ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                  {item.used} / {item.limit}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${item.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                <span>{item.remaining} remaining</span>
                {isExhausted && <span className="text-rose-600 font-medium">Limit reached</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UsageCard;

