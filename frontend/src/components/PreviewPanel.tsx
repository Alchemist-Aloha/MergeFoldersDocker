import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Image as ImageIcon, ExternalLink, RefreshCw, CheckSquare, Square, Trash2 } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

const API_BASE = window.location.origin;

export default function PreviewPanel() {
  const { previewPath, selectedPaths, toggleSelection, triggerRefresh, refreshKey } = useStore();
  const [images, setImages] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchImages = () => {
    if (!previewPath) {
      setImages([]);
      return;
    }

    setLoading(true);
    console.log("Fetching images for path:", previewPath);
    fetch(`${API_BASE}/api/fs/list?path=${encodeURIComponent(previewPath)}`)
      .then(res => res.json())
      .then(data => {
        console.log("Received data for preview:", data);
        if (Array.isArray(data)) {
          // More robust image extension check
          const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff)$/i;
          const filtered = data.filter(f => !f.isDir && f.name.match(imageExtensions));
          console.log("Filtered images:", filtered);
          setImages(filtered);
        } else {
          setImages([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchImages();
  }, [previewPath, refreshKey]);

  const selectedInPreview = images.filter(img => selectedPaths.includes(img.path));
  const allSelected = images.length > 0 && selectedInPreview.length === images.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      images.forEach(img => {
        if (selectedPaths.includes(img.path)) toggleSelection(img.path);
      });
    } else {
      images.forEach(img => {
        if (!selectedPaths.includes(img.path)) toggleSelection(img.path);
      });
    }
  };

  const deleteSelectedFiles = () => {
    if (selectedInPreview.length === 0) return;
    if (!confirm(`Are you sure you want to PERMANENTLY delete ${selectedInPreview.length} selected files?`)) return;

    setLoading(true);
    fetch(`${API_BASE}/api/fs/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: selectedInPreview.map(img => img.path) })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        selectedInPreview.forEach(img => toggleSelection(img.path));
        fetchImages();
        triggerRefresh();
      }
      setLoading(false);
    })
    .catch(err => {
      alert(`Failed to delete: ${err.message}`);
      setLoading(false);
    });
  };

  if (!previewPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
        <ImageIcon size={48} className="mb-2 opacity-20" />
        <p className="text-sm font-medium">Select a folder to preview its contents</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <button 
            onClick={toggleSelectAll}
            className="p-1 hover:bg-gray-200 rounded shrink-0"
            title={allSelected ? "Deselect All" : "Select All"}
          >
            {allSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} className="text-gray-300" />}
          </button>
          <div className="overflow-hidden">
            <h2 className="font-bold text-gray-700 truncate">Preview: {previewPath.split('/').pop()}</h2>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{images.length} images</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedInPreview.length > 0 && (
            <button 
              onClick={deleteSelectedFiles}
              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Delete selected files"
            >
              <Trash2 size={14} /> Delete ({selectedInPreview.length})
            </button>
          )}
          <button 
            onClick={fetchImages}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Refresh previews"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <RefreshCw size={24} className="animate-spin" />
            <p className="text-sm">Generating previews...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 italic">
            <ImageIcon size={32} className="mb-2 opacity-20" />
            <p className="text-sm">No images found in this folder</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map(img => {
              const isSelected = selectedPaths.includes(img.path);
              return (
                <div key={img.path} className="group relative flex flex-col gap-1.5">
                  <div 
                    className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center relative shadow-sm transition-all hover:shadow-md ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => toggleSelection(img.path)}
                  >
                    <img 
                      src={`${API_BASE}/api/fs/thumb?path=${encodeURIComponent(img.path)}`} 
                      alt={img.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                      }}
                    />
                    
                    {/* Checkbox overlay always visible or on hover */}
                    <div className={`absolute top-2 left-2 p-0.5 rounded backdrop-blur-md bg-white/80 shadow-sm transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-400" />}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                      <div className="flex justify-between items-center text-white pointer-events-auto">
                        <span className="text-[10px] font-medium truncate pr-4">{(img.size / 1024).toFixed(0)} KB</span>
                        <a 
                          href={`${API_BASE}/api/fs/thumb?path=${encodeURIComponent(img.path)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 bg-white/20 hover:bg-white/40 rounded backdrop-blur-sm transition-colors"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className={`text-[10px] truncate text-center px-1 font-medium ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} title={img.name}>
                    {img.name}
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
