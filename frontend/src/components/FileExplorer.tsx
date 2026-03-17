import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Folder, File as FileIcon, Image as ImageIcon, ChevronLeft, CheckSquare, Square } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

const API_BASE = window.location.origin;

export default function FileExplorer() {
  const { 
    currentPath, setCurrentPath, 
    selectedPaths, toggleSelection, clearSelection,
    setPreviewPath, previewPath, refreshKey, setActiveView
  } = useStore();
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
  }, [currentPath, refreshKey]);

  const goUp = () => {
    const parts = currentPath.split('/');
    if (parts.length > 3) { // Assuming root is /app/data
      setCurrentPath(parts.slice(0, -1).join('/'));
    }
  };

  const handleRowClick = (file: FileEntry) => {
    if (file.isDir) {
      setPreviewPath(file.path);
      // On mobile, switch to preview view automatically when a folder is clicked
      if (window.innerWidth < 768) {
        setActiveView('preview');
      }
    }
  };

  const handleDoubleClick = (file: FileEntry) => {
    if (file.isDir) {
      setCurrentPath(file.path);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-3 md:p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <button 
            onClick={goUp} 
            disabled={currentPath === '/app/data'}
            className="p-1.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs md:text-sm font-medium text-gray-700 truncate">{currentPath}</span>
        </div>
      </div>

      {selectedPaths.length > 0 && (
        <div className="bg-blue-50 px-3 md:px-4 py-1.5 md:py-2 border-b border-blue-100 flex items-center justify-between">
          <span className="text-[11px] md:text-sm font-bold text-blue-700">{selectedPaths.length} selected</span>
          <button 
            onClick={clearSelection}
            className="text-[10px] md:text-xs text-blue-600 hover:underline font-bold uppercase"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-1.5 md:p-2">
        {loading ? (
          <div className="flex justify-center p-8 text-gray-400 text-sm">Loading...</div>
        ) : files.length === 0 ? (
          <div className="flex justify-center p-8 text-gray-400 italic text-sm">Empty directory</div>
        ) : (
          <div className="grid grid-cols-1 gap-0.5 md:gap-1">
            {files.map(file => {
              const isSelected = selectedPaths.includes(file.path);
              const isPreviewed = previewPath === file.path;
              
              return (
                <div 
                  key={file.path}
                  className={`flex items-center gap-2 md:gap-3 p-2 md:p-2.5 rounded-md cursor-pointer group transition-colors ${
                    isPreviewed ? 'bg-blue-100' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleRowClick(file)}
                  onDoubleClick={() => handleDoubleClick(file)}
                >
                  <div 
                    className="p-1.5 hover:bg-gray-200 rounded-md shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(file.path);
                    }}
                  >
                    {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-300" />}
                  </div>
                  
                  <div className="text-gray-400 group-hover:text-blue-500 transition-colors shrink-0">
                    {file.isDir ? <Folder size={20} fill="currentColor" className="text-yellow-400 border-yellow-400" /> : 
                     file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <div className={`truncate text-xs md:text-sm ${file.isDir ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                      {file.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
