import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Folder, File as FileIcon, Image as ImageIcon, ChevronLeft } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

const API_BASE = 'http://localhost:8080';

export default function FileExplorer() {
  const { currentPath, setCurrentPath, setSourcePath, setDestPath } = useStore();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/fs/list?path=${encodeURIComponent(currentPath)}`)
      .then(res => res.json())
      .then(data => {
        setFiles(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [currentPath]);

  const goUp = () => {
    const parts = currentPath.split('/');
    if (parts.length > 3) { // Assuming root is /app/data
      setCurrentPath(parts.slice(0, -1).join('/'));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <button 
            onClick={goUp} 
            disabled={currentPath === '/app/data'}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium text-gray-700 truncate">{currentPath}</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => setSourcePath(currentPath)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Src
          </button>
          <button 
            onClick={() => setDestPath(currentPath)}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Dst
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center p-8 text-gray-400">Loading...</div>
        ) : files.length === 0 ? (
          <div className="flex justify-center p-8 text-gray-400 italic">Empty directory</div>
        ) : (
          <div className="grid grid-cols-1 gap-1">
            {files.map(file => (
              <div 
                key={file.path}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer group"
                onClick={() => file.isDir && setCurrentPath(file.path)}
              >
                <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
                  {file.isDir ? <Folder size={20} fill="currentColor" className="text-yellow-400 border-yellow-400" /> : 
                   file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className={`truncate ${file.isDir ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                    {file.name}
                  </div>
                  {!file.isDir && (
                    <div className="text-xs text-gray-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
