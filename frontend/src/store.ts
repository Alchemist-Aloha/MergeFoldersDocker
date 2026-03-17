import { create } from 'zustand'

interface AppState {
  currentPath: string;
  sourcePath: string | null;
  destPath: string | null;
  setCurrentPath: (p: string) => void;
  setSourcePath: (p: string | null) => void;
  setDestPath: (p: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  currentPath: '/app/data',
  sourcePath: null,
  destPath: null,
  setCurrentPath: (p) => set({ currentPath: p }),
  setSourcePath: (p) => set({ sourcePath: p }),
  setDestPath: (p) => set({ destPath: p }),
}))
