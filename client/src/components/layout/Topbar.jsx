import { Menu, Search, X, RefreshCw } from 'lucide-react';

/**
 * Topbar Component
 * Sticky top navigation bar featuring mobile menu trigger, section title,
 * global debounced search input, server health status pill, and user avatar.
 */
function Topbar({
  onOpenMobileSidebar,
  currentView,
  setCurrentView,
  searchTerm,
  setSearchTerm,
  serverStatus,
  onRefreshHealth,
  user,
}) {
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSearchFocus = () => {
    if (currentView !== 'history') {
      setCurrentView('history');
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left Side: Mobile Menu Button & Section Title */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition duration-150 focus:outline-none"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate tracking-tight">
              {currentView === 'history' ? 'Transcript History' : 'Transcribe Audio'}
            </h2>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="hidden sm:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={handleSearchFocus}
              placeholder="Search transcripts by text or filename..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition duration-150"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Server Health Pill & User Avatar */}
        <div className="flex items-center space-x-2.5 flex-shrink-0">
          {/* Step 1 Health Indicator Pill */}
          <div
            onClick={onRefreshHealth}
            title="Click to check backend health"
            className="cursor-pointer flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition duration-150 bg-white hover:bg-slate-50"
          >
            {serverStatus === 'checking' && (
              <div className="flex items-center space-x-1.5 text-amber-600">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                <span className="hidden md:inline">Checking</span>
              </div>
            )}

            {serverStatus === 'connected' && (
              <div className="flex items-center space-x-1.5 text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden md:inline font-medium">Server Online</span>
              </div>
            )}

            {serverStatus === 'down' && (
              <div className="flex items-center space-x-1.5 text-rose-700">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="hidden md:inline font-medium">Server Offline</span>
              </div>
            )}
          </div>

          {/* User Avatar Circle */}
          <div
            className="w-8 h-8 rounded-full bg-slate-900 text-white font-semibold text-xs flex items-center justify-center border border-slate-200"
            title={user?.name || 'User'}
          >
            {getInitials(user?.name)}
          </div>
        </div>
      </div>

      {/* Mobile-only Search Bar (under topbar) */}
      <div className="sm:hidden px-4 pb-3 pt-1">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleSearchFocus}
            placeholder="Search transcripts..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;

