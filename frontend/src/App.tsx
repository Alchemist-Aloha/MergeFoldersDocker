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
  const { selectedPaths, clearSelection } = useStore();
  const [policy, setPolicy] = useState('rename');
  const [dryRun, setDryRun] = useState(true);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [merging, setMerging] = useState(false);

  const autoDestination = useMemo(() => {
    if (selectedPaths.length === 0) return null;
    return `${selectedPaths[0]}_merged`;
  }, [selectedPaths]);

  useEffect(() => {
    const ws = new WebSocket(WS_BASE);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'progress') {
        setProgress(msg.data.percent);
        if (msg.data.percent === 100) {
          setMerging(false);
          addLog('Operation complete', 'success');
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
    if (selectedPaths.length === 0 || !autoDestination) return;
    setMerging(true);
    setProgress(0);
    setLogs([]);
    addLog(`Initiating batch merge of ${selectedPaths.length} folders into ${autoDestination.split('/').pop()}...`);

    fetch(`${API_BASE}/api/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sources: selectedPaths, 
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
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <Layout size={20} />
          </div>
          <h1 className="text-lg font-bold tracking-tight">MergeFoldersDocker</h1>
        </div>
        
        <div className="flex items-center gap-4">
          {merging && (
            <div className="flex items-center gap-3">
              <div className="w-32 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              <span className="text-xs font-bold text-blue-600">{progress}%</span>
            </div>
          )}
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${merging ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
            {merging ? 'Processing' : 'Ready'}
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left: File Explorer */}
        <div className="w-1/3 flex flex-col gap-4 min-w-[350px]">
          <FileExplorer />
        </div>

        {/* Right: Preview and Dashboard */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Preview Panel */}
            <div className="flex-1 overflow-hidden">
              <PreviewPanel />
            </div>

            {/* Dashboard / Controls */}
            <div className="w-80 flex flex-col gap-4 shrink-0 overflow-y-auto">
              {/* Merge Controls */}
              <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-4">
                <h2 className="text-sm font-bold flex items-center gap-2 text-gray-600 uppercase tracking-wider">
                  <Settings2 size={16} className="text-blue-600" />
                  Merge Dashboard
                </h2>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Selected Folders</label>
                    <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-900 min-h-[40px] max-h-[80px] overflow-y-auto">
                      {selectedPaths.length > 0 ? (
                        <ul className="list-disc list-inside">
                          {selectedPaths.map(p => <li key={p} className="truncate">{p.split('/').pop()}</li>)}
                        </ul>
                      ) : <span className="italic opacity-50">No folders selected</span>}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Target Destination</label>
                    <div className="p-2 bg-green-50 border border-green-100 rounded text-xs text-green-900 truncate">
                      {autoDestination ? (
                        <span className="font-medium underline decoration-dotted">{autoDestination.split('/').pop()}</span>
                      ) : <span className="italic opacity-50">Select folders to see target</span>}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Policy</label>
                    <select 
                      value={policy}
                      onChange={(e) => setPolicy(e.target.value)}
                      className="w-full p-2 text-xs border border-gray-200 rounded bg-white outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="rename">Safe Rename</option>
                      <option value="overwrite">Overwrite</option>
                      <option value="skip">Skip Existing</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-100 rounded cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-gray-700">Dry Run Mode</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button 
                      onClick={startMerge}
                      disabled={selectedPaths.length === 0 || merging}
                      className="py-2.5 bg-blue-600 text-white text-xs font-bold rounded shadow-sm hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-1.5"
                    >
                      <Merge size={14} /> Merge
                    </button>
                    <button 
                      onClick={startDelete}
                      disabled={selectedPaths.length === 0 || merging}
                      className="py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100 hover:bg-red-100 disabled:opacity-30 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </section>

              {/* Logs */}
              <section className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden min-h-[200px]">
                <h2 className="px-4 py-2 border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Activity Logs
                </h2>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] flex flex-col gap-1.5 bg-gray-900 text-gray-300">
                  {logs.length === 0 ? (
                    <div className="text-gray-600 italic text-center py-4">No activity yet.</div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="flex gap-2 leading-tight">
                        <span className="text-gray-500 shrink-0">{log.time.split(' ')[0]}</span>
                        <span className={`${
                          log.type === 'error' ? 'text-red-400' : 
                          log.type === 'success' ? 'text-green-400 font-bold' : 
                          'text-blue-300'
                        }`}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
