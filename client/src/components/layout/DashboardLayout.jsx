import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

/**
 * DashboardLayout Component
 * Clean SaaS dashboard layout with fixed left sidebar (responsive sliding drawer on mobile),
 * sticky topbar, and centered content container.
 */
function DashboardLayout({
  children,
  currentView,
  setCurrentView,
  user,
  onLogout,
  serverStatus,
  onRefreshHealth,
  searchTerm,
  setSearchTerm,
  detectSpeakers,
  setDetectSpeakers,
  navigate,
  usage,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        onLogout={onLogout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        detectSpeakers={detectSpeakers}
        setDetectSpeakers={setDetectSpeakers}
        navigate={navigate}
        usage={usage}
      />

      {/* Main Content Area (offset by 240px / w-60 on lg screens) */}
      <div className="flex-1 flex flex-col lg:pl-60 min-w-0">
        {/* Sticky Topbar */}
        <Topbar
          onOpenMobileSidebar={() => setMobileOpen(true)}
          currentView={currentView}
          setCurrentView={setCurrentView}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          serverStatus={serverStatus}
          onRefreshHealth={onRefreshHealth}
          user={user}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;

