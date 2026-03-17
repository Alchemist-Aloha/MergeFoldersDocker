import { useState, useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import { useStore } from './store';
import { Play, Settings2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

const API_BASE = window.location.origin;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${protocol}//${window.location.host}/ws`;

interface LogMessage {
  time: string;
  message: string;
  type: 'log' | 'error' | 'success';
}

function App() {
  const { sourcePath, destPath, setSourcePath, setDestPath } = useStore();
  const [policy, setPolicy] = useState('rename');
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WS_BASE);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'progress') {
        setProgress(msg.data.percent);
        if (msg.data.percent === 100) {
          setMerging(false);
          addLog('Merge complete', 'success');
        }
      } else if (msg.type === 'log') {
        addLog(msg.data.message);
      } else if (msg.type === 'error') {
        addLog(msg.data.message, 'error');
        setMerging(false);
      }
    };
    return () => ws.close();
  }, []);

  const addLog = (message: string, type: 'log' | 'error' | 'success' = 'log') => {
    setLogs(prev => [{
      time: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev.slice(0, 49)]);
  };

  const startMerge = () => {
    if (!sourcePath || !destPath) return;
    setMerging(true);
    setProgress(0);
    setLogs([]);
    addLog(`Initiating merge (${policy}, dryRun: ${dryRun})...`);

    fetch(`${API_BASE}/api/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        source: sourcePath, 
        destination: destPath, 
        policy, 
        dryRun 
      })
    }).catch(err => {
      addLog(`Failed to start merge: ${err.message}`, 'error');
      setMerging(false);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Settings2 size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">MergeFoldersDocker</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-gray-500">
            {merging ? 'Processing...' : 'Ready'}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden max-h-[calc(100vh-73px)]">
        {/* Left Column: Explorer */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
          <FileExplorer />
        </div>

        {/* Right Column: Dashboard & Logs */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto">
          {/* Dashboard */}
          <section className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Play size={20} className="text-blue-600" />
              Merge Control
            </h2>

            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Source Folder</label>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-md flex items-center justify-between group">
                  <span className="text-sm text-blue-900 truncate font-medium">{sourcePath || 'None selected'}</span>
                  {sourcePath && <button onClick={() => setSourcePath(null)} className="text-blue-300 hover:text-blue-600"><Trash2 size={16} /></button>}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Destination Folder</label>
                <div className="p-3 bg-green-50 border border-green-100 rounded-md flex items-center justify-between group">
                  <span className="text-sm text-green-900 truncate font-medium">{destPath || 'None selected'}</span>
                  {destPath && <button onClick={() => setDestPath(null)} className="text-green-300 hover:text-green-600"><Trash2 size={16} /></button>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conflict Policy</label>
                  <select 
                    value={policy}
                    onChange={(e) => setPolicy(e.target.value)}
                    className="w-full p-2 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="rename">Safe Rename</option>
                    <option value="overwrite">Overwrite</option>
                    <option value="skip">Skip Existing</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Options</label>
                  <label className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-100 rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={dryRun} 
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Dry Run</span>
                  </label>
                </div>
              </div>

              <button 
                onClick={startMerge}
                disabled={!sourcePath || !destPath || merging}
                className="w-full mt-2 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-200 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} fill="currentColor" />
                {merging ? 'Merging...' : 'Execute Merge'}
              </button>
            </div>

            {/* Progress Bar */}
            {merging && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-blue-600">Progress</span>
                  <span className="text-gray-500">{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </section>

          {/* Activity Logs */}
          <section className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden min-h-[300px]">
            <h2 className="p-4 border-b border-gray-100 bg-gray-50 text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              Activity Logs
              <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{logs.length} entries</span>
            </h2>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] flex flex-col gap-2">
              {logs.length === 0 ? (
                <div className="text-gray-300 italic text-center py-8">No activity logs yet.</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3 leading-relaxed border-l-2 pl-3 border-gray-100 hover:border-blue-200 transition-colors group">
                    <span className="text-gray-300 shrink-0 select-none">{log.time}</span>
                    <div className="flex items-start gap-2 overflow-hidden">
                      {log.type === 'error' && <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />}
                      {log.type === 'success' && <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />}
                      <span className={`break-all ${
                        log.type === 'error' ? 'text-red-600' : 
                        log.type === 'success' ? 'text-green-600 font-bold' : 
                        'text-gray-600'
                      }`}>
                        {log.message}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
