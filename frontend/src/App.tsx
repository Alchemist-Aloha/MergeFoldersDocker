import { useState, useEffect, useMemo } from 'react';
import FileExplorer from './components/FileExplorer';
import PreviewPanel from './components/PreviewPanel';
import { useStore, type ViewType } from './store';
import { Settings2, Trash2, Layout, Merge, Folder, Image as ImageIcon, Activity } from 'lucide-react';

const API_BASE = window.location.origin;
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_BASE = `${protocol}//${window.location.host}/ws`;

interface LogMessage {
  time: string;
  message: string;
  type: 'log' | 'error' | 'success';
}

function App() {
  const { selectedPaths, clearSelection, triggerRefresh, activeView, setActiveView } = useStore();
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

  const NavButton = ({ view, icon: Icon, label }: { view: ViewType, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveView(view)}
      className={`flex flex-col items-center gap-1 flex-1 py-2 transition-colors ${
        activeView === view ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <Icon size={20} />
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );

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

      <main className="flex-1 flex overflow-hidden p-2 md:p-4 gap-4 relative">
        {/* Mobile View Logic */}
        <div className={`flex-1 md:flex gap-4 overflow-hidden ${activeView === 'explorer' ? 'flex' : 'hidden md:flex'}`}>
          <div className="w-full md:w-1/3 flex flex-col gap-4 md:min-w-[350px]">
            <FileExplorer />
          </div>
        </div>

        <div className={`flex-1 md:flex gap-4 overflow-hidden ${activeView === 'preview' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-1 overflow-hidden">
            <PreviewPanel />
          </div>
        </div>

        <div className={`flex-1 md:flex gap-4 overflow-hidden ${activeView === 'dashboard' ? 'flex' : 'hidden md:flex'}`}>
          <div className="w-full md:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto">
            {/* Dashboard */}
            <section className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-4">
              <h2 className="text-sm font-bold flex items-center gap-2 text-gray-600 uppercase tracking-wider">
                <Settings2 size={16} className="text-blue-600" />
                Dashboard
              </h2>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Selected Items</label>
                  <div className="p-2 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-900 min-h-[40px] max-h-[120px] overflow-y-auto">
                    {selectedPaths.length > 0 ? (
                      <ul className="list-disc list-inside">
                        {selectedPaths.map(p => <li key={p} className="truncate">{p.split('/').pop()}</li>)}
                      </ul>
                    ) : <span className="italic opacity-50 text-[10px]">No items selected</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Target</label>
                  <div className="p-2 bg-green-50 border border-green-100 rounded text-[11px] text-green-900 truncate font-medium">
                    {autoDestination ? autoDestination.split('/').pop() : 'N/A'}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Policy</label>
                  <select 
                    value={policy}
                    onChange={(e) => setPolicy(e.target.value)}
                    className="w-full p-2 text-xs border border-gray-200 rounded bg-white outline-none"
                  >
                    <option value="rename">Rename</option>
                    <option value="overwrite">Overwrite</option>
                    <option value="skip">Skip</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-100 rounded cursor-pointer">
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="w-3 h-3" />
                  <span className="text-[11px] font-medium text-gray-700">Dry Run</span>
                </label>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={startMerge}
                    disabled={selectedFolders.length === 0 || merging}
                    className="py-2 bg-blue-600 text-white text-[11px] font-bold rounded shadow-sm disabled:opacity-30 flex items-center justify-center gap-1"
                  >
                    <Merge size={12} /> Merge
                  </button>
                  <button 
                    onClick={startDelete}
                    disabled={selectedPaths.length === 0 || merging}
                    className="py-2 bg-red-50 text-red-600 text-[11px] font-bold rounded border border-red-100 disabled:opacity-30 flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </section>

            {/* Logs */}
            <section className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden min-h-[200px] mb-12 md:mb-0">
              <h2 className="px-4 py-2 border-b border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Logs
              </h2>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] md:text-[10px] flex flex-col gap-1.5 bg-gray-900 text-gray-300">
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
      </main>

      {/* Mobile Bottom Navigation */}
      <footer className="md:hidden bg-white border-t border-gray-200 flex items-center justify-around px-2 py-1 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] shrink-0 z-20">
        <NavButton view="explorer" icon={Folder} label="Files" />
        <NavButton view="preview" icon={ImageIcon} label="Preview" />
        <NavButton view="dashboard" icon={Activity} label="Status" />
      </footer>
    </div>
  );
}

export default App;
