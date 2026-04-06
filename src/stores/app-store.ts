import { create } from "zustand";
import type { Series, Thread } from "../types";

interface AppState {
  selectedSeriesId: string | null;
  selectedThreadId: string | null;
  seriesList: Series[];
  threadList: Thread[];
  showPasteDialog: boolean;
  showSettings: boolean;

  setSelectedSeriesId: (id: string | null) => void;
  setSelectedThreadId: (id: string | null) => void;
  setSeriesList: (list: Series[]) => void;
  setThreadList: (list: Thread[]) => void;
  setShowPasteDialog: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSeriesId: null,
  selectedThreadId: null,
  seriesList: [],
  threadList: [],
  showPasteDialog: false,
  showSettings: false,

  setSelectedSeriesId: (id) => set({ selectedSeriesId: id, selectedThreadId: null }),
  setSelectedThreadId: (id) => set({ selectedThreadId: id }),
  setSeriesList: (list) => set({ seriesList: list }),
  setThreadList: (list) => set({ threadList: list }),
  setShowPasteDialog: (show) => set({ showPasteDialog: show }),
  setShowSettings: (show) => set({ showSettings: show }),
}));
