import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'connected' | 'down'
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = async () => {
    setServerStatus('checking');
    try {
      // Calls /api/health (proxied via Vite to http://localhost:5000)
      const response = await axios.get('/api/health');
      if (response.data && response.data.status === 'ok') {
        setServerStatus('connected');
        setLastChecked(new Date().toLocaleTimeString());
      } else {
        setServerStatus('down');
      }
    } catch (error) {
      console.error('Failed to connect to backend server:', error.message);
      setServerStatus('down');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-slate-100">
      <div className="w-full max-w-md p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700/60">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Audio to Text Transcriber
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Step 1: Project Setup & Health Verification
          </p>
        </div>

        <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-900/60 border border-slate-700/40">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
            Backend Status
          </span>

          {serverStatus === 'checking' && (
            <div className="flex items-center space-x-2 text-amber-400 font-medium">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              <span>Checking server status...</span>
            </div>
          )}

          {serverStatus === 'connected' && (
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-lg">
              <span className="h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-emerald-950 animate-pulse" />
              <span>Server connected</span>
            </div>
          )}

          {serverStatus === 'down' && (
            <div className="flex items-center space-x-2 text-rose-400 font-semibold text-lg">
              <span className="h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-950" />
              <span>Server down</span>
            </div>
          )}

          {lastChecked && (
            <span className="text-xs text-slate-500 mt-3">
              Last checked at {lastChecked}
            </span>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={checkHealth}
            disabled={serverStatus === 'checking'}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-800"
          >
            Recheck Health
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;

