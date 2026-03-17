import { useState, useEffect, useMemo } from 'react';
import FileExplorer from './components/FileExplorer';
import PreviewPanel from './components/PreviewPanel';
import { useStore } from './store';
import { Settings2, Trash2, Layout, Merge } from 'lucide-react';

const API_BASE = window.location.origin;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${protocol}//${window.location.host}/ws`;

interface LogMessage {
  time: string;
  message: string;
  type: 'log' | 'error' | 'success';
}

function App() {
  const { selectedPaths, clearSelection, triggerRefresh } = useStore();
  const [policy, setPolicy] = useState('rename');
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [merging, setMerging] = useState(false);

  const selectedFolders = useMemo(() => {
    return selectedPaths.filter(p => !p.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i));
  }, [selectedPaths]);

  const autoDestination = useMemo(() => {
    if (selectedFolders.length === 0) return null;
    return `${selectedFolders[0]}_merged`;
  }, [selectedFolders]);

  useEffect(() => {
    const ws = new WebSocket(WS_BASE);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'progress') {
        setProgress(msg.data.percent);
        if (msg.data.percent === 100) {
          setMerging(false);
          addLog('Operation complete', 'success');
          triggerRefresh();
          clearSelection();
        }
      } else if (msg.type === 'log') {
        addLog(msg.data.message);
      } else if (msg.type === 'error') {
        addLog(msg.data.message, 'error');
        setMerging(false);
      }
    };
    return () => ws.close();
  }, [triggerRefresh, clearSelection]);

  const addLog = (message: string, type: 'log' | 'error' | 'success' = 'log') => {
    setLogs(prev => [{
      time: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev.slice(0, 49)]);
  };

  const startMerge = () => {
    if (selectedFolders.length === 0 || !autoDestination) return;
    setMerging(true);
    setProgress(0);
    setLogs([]);
    addLog(`Initiating batch merge of ${selectedFolders.length} folders...`);

    fetch(`${API_BASE}/api/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sources: selectedFolders, 
        destination: autoDestination, 
        policy, 
        dryRun 
      })
    }).catch(err => {
      addLog(`Failed to start merge: ${err.message}`, 'error');
      setMerging(false);
    });
  };

  const startDelete = () => {
    if (selectedPaths.length === 0) return;
    if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedPaths.length} items?`)) return;
    
    setMerging(true);
    addLog(`Deleting ${selectedPaths.length} items...`);

    fetch(`${API_BASE}/api/fs/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: selectedPaths })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        addLog(data.error, 'error');
      } else {
        addLog(`Successfully removed ${selectedPaths.length} items`, 'success');
        triggerRefresh();
        clearSelection();
      }
      setMerging(false);
    })
    .catch(err => {
      addLog(`Failed to delete: ${err.message}`, 'error');
      setMerging(false);
    });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-2 md:py-3 flex items-center justify-between shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-blue-600 p-1 md:p-1.5 rounded-lg text-white">
            <Layout size={18} className="md:w-5 md:h-5" />
          </div>
          <h1 className="text-sm md:text-lg font-bold tracking-tight">MergeFolders</h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {merging && (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-16 md:w-32 bg-gray-100 rounded-full h-1 md:h-1.5 overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="text-[10px] md:text-xs font-bold text-blue-600">{progress}%</span>
            </div>
          )}
          <div className={`px-1.5 py-0.5 rounded text-[8px] md:text-[10px] font-bold uppercase tracking-wider ${merging ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
            {merging ? 'Processing' : 'Ready'}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
        {/* Top Panel (Mobile) / Left Panel (Desktop): Explorer */}
        <div className="h-[35vh] md:h-full w-full md:w-1/3 flex flex-col gap-4 md:min-w-[350px]">
          <FileExplorer />
        </div>

        {/* Bottom Split (Mobile) / Right Side (Desktop) */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 overflow-hidden">
          {/* Middle Panel (Mobile) / Middle (Desktop): Preview */}
          <div className="flex-1 overflow-hidden min-h-[30vh]">
            <PreviewPanel />
          </div>

          {/* Bottom Panel (Mobile) / Right (Desktop): Dashboard & Logs */}
          <div className="h-[25vh] md:h-full w-full md:w-80 flex flex-col gap-2 md:gap-4 shrink-0 overflow-hidden">
            {/* Dashboard */}
            <section className="bg-white p-3 md:p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2 md:gap-4 overflow-y-auto">
              <h2 className="text-[10px] md:text-sm font-bold flex items-center gap-2 text-gray-600 uppercase tracking-wider">
                <Settings2 size={14} className="text-blue-600 md:w-4 md:h-4" />
                Dashboard
              </h2>

              <div className="space-y-2 md:space-y-3">
                <div className="flex gap-2 md:block">
                  <div className="flex-1 space-y-1">
                    <label className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">Target</label>
                    <div className="p-1.5 md:p-2 bg-green-50 border border-green-100 rounded text-[9px] md:text-[11px] text-green-900 truncate font-medium">
                      {autoDestination ? autoDestination.split('/').pop() : 'N/A'}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase">Policy</label>
                    <select 
                      value={policy}
                      onChange={(e) => setPolicy(e.target.value)}
                      className="w-full p-1 md:p-2 text-[9px] md:text-xs border border-gray-200 rounded bg-white outline-none"
                    >
                      <option value="rename">Rename</option>
                      <option value="overwrite">Overwrite</option>
                      <option value="skip">Skip</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 p-1.5 bg-gray-50 border border-gray-100 rounded cursor-pointer shrink-0">
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    <span className="text-[9px] md:text-[11px] font-medium text-gray-700">Dry Run</span>
                  </label>
                  
                  <div className="flex-1 grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={startMerge}
                      disabled={selectedFolders.length === 0 || merging}
                      className="py-1.5 bg-blue-600 text-white text-[9px] md:text-[11px] font-bold rounded shadow-sm disabled:opacity-30 flex items-center justify-center gap-1"
                    >
                      <Merge size={10} className="md:w-3 md:h-3" /> Merge
                    </button>
                    <button 
                      onClick={startDelete}
                      disabled={selectedPaths.length === 0 || merging}
                      className="py-1.5 bg-red-50 text-red-600 text-[9px] md:text-[11px] font-bold rounded border border-red-100 disabled:opacity-30 flex items-center justify-center gap-1"
                    >
                      <Trash2 size={10} className="md:w-3 md:h-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Logs */}
            <section className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
              <h2 className="px-3 py-1.5 md:px-4 md:py-2 border-b border-gray-100 bg-gray-50 text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Logs
              </h2>
              <div className="flex-1 overflow-y-auto p-2 md:p-3 font-mono text-[8px] md:text-[10px] flex flex-col gap-1 bg-gray-900 text-gray-300">
                {logs.length === 0 ? (
                  <div className="text-gray-600 italic text-center py-2 md:py-4">No activity yet.</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-1.5 leading-tight">
                      <span className="text-gray-500 shrink-0">{log.time.split(' ')[0]}</span>
                      <span className={`${
                        log.type === 'error' ? 'text-red-400' : 
                        log.type === 'success' ? 'text-green-400 font-bold' : 
                        'text-blue-300'
                      } break-all`}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
