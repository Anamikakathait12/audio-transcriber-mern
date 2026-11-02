import { Mic, FileText, Users, LogOut, X, Sparkles, AudioWaveform } from 'lucide-react';

/**
 * Sidebar Component
 * Fixed ~240px left sidebar for desktop and sliding drawer for mobile devices (<1024px).
 * Displays app branding, navigation links, tools, and user profile card with logout.
 */
function Sidebar({
  currentView,
  setCurrentView,
  user,
  onLogout,
  mobileOpen,
  setMobileOpen,
  detectSpeakers,
  setDetectSpeakers,
}) {
  const handleNavClick = (view) => {
    setCurrentView(view);
    setMobileOpen(false);
  };

  const handleSpeakerToolClick = () => {
    setCurrentView('transcribe');
    setDetectSpeakers(true);
    setMobileOpen(false);
  };

  // Extract initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const navItems = [
    {
      id: 'transcribe',
      label: 'Transcribe',
      icon: Mic,
      description: 'Upload & record',
    },
    {
      id: 'history',
      label: 'History',
      icon: FileText,
      description: 'Past transcripts',
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
            <AudioWaveform className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-900 text-base tracking-tight">Audiqo</span>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/60">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-600">Speech to text engine</p>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition duration-150"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        <div>
          <p className="px-2.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150 text-left ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-600'}`} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tools Section */}
        <div>
          <p className="px-2.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            Tools
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleSpeakerToolClick}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm transition duration-150 text-left ${
                detectSpeakers && currentView === 'transcribe'
                  ? 'bg-indigo-50/70 text-indigo-800 font-medium'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <div className="flex-1 min-w-0">
                <span className="block truncate">Speaker detection</span>
              </div>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                AssemblyAI
              </span>
            </button>
          </div>
        </div>

        {/* Mini Pro Tip Banner */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Fast Whisper & Diarize</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Upload up to 25 MB in MP3, WAV, M4A, WEBM, OGG, OGA, or OPUS formats.
          </p>
        </div>
      </div>

      {/* Bottom User Profile Card */}
      <div className="p-3.5 border-t border-slate-200 bg-white">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-semibold text-xs flex items-center justify-center flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.name || 'Account'}
              </p>
              <p className="text-[11px] text-slate-600 truncate">
                {user?.email || 'Logged in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition duration-150"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (fixed ~240px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 z-30">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sliding Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 max-w-[80vw] z-50 lg:hidden transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {content}
      </div>
    </>
  );
}

export default Sidebar;

