import { create } from 'zustand'

interface AppState {
  currentPath: string;
  selectedPaths: string[];
  previewPath: string | null;
  
  setCurrentPath: (p: string) => void;
  setPreviewPath: (p: string | null) => void;
  
  toggleSelection: (p: string) => void;
  clearSelection: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentPath: '/app/data',
  selectedPaths: [],
  previewPath: null,
  
  setCurrentPath: (p) => set({ currentPath: p }),
  setPreviewPath: (p) => set({ previewPath: p }),
  
  toggleSelection: (path) => set((state) => {
    const isSelected = state.selectedPaths.includes(path);
    if (isSelected) {
      return { selectedPaths: state.selectedPaths.filter((p) => p !== path) };
    } else {
      return { selectedPaths: [...state.selectedPaths, path] };
    }
  }),
  clearSelection: () => set({ selectedPaths: [] }),
}))
