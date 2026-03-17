import { create } from 'zustand'

export type ViewType = 'explorer' | 'preview' | 'dashboard';

interface AppState {
  currentPath: string;
  selectedPaths: string[];
  previewPath: string | null;
  refreshKey: number;
  activeView: ViewType;
  
  setCurrentPath: (p: string) => void;
  setPreviewPath: (p: string | null) => void;
  setActiveView: (v: ViewType) => void;
  
  toggleSelection: (p: string) => void;
  clearSelection: () => void;
  triggerRefresh: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentPath: '/app/data',
  selectedPaths: [],
  previewPath: null,
  refreshKey: 0,
  activeView: 'explorer',
  
  setCurrentPath: (p) => set({ currentPath: p }),
  setPreviewPath: (p) => set({ previewPath: p }),
  setActiveView: (v) => set({ activeView: v }),
  
  toggleSelection: (path) => set((state) => {
    const isSelected = state.selectedPaths.includes(path);
    if (isSelected) {
      return { selectedPaths: state.selectedPaths.filter((p) => p !== path) };
    } else {
      return { selectedPaths: [...state.selectedPaths, path] };
    }
  }),
  clearSelection: () => set({ selectedPaths: [] }),
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}))
