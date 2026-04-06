import { create } from "zustand";
import type { LLMProviderType } from "../types";

interface SettingsState {
  llmProvider: LLMProviderType;
  llmApiKey: string;
  llmModel: string;
  concurrency: number;
  batchBlocks: boolean;

  setLlmProvider: (provider: LLMProviderType) => void;
  setLlmApiKey: (key: string) => void;
  setLlmModel: (model: string) => void;
  setConcurrency: (n: number) => void;
  setBatchBlocks: (v: boolean) => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  llmProvider: "openai",
  llmApiKey: "",
  llmModel: "gpt-4.1-mini",
  concurrency: 3,
  batchBlocks: false,

  setLlmProvider: (provider) => set({ llmProvider: provider }),
  setLlmApiKey: (key) => set({ llmApiKey: key }),
  setLlmModel: (model) => set({ llmModel: model }),
  setConcurrency: (n) => set({ concurrency: n }),
  setBatchBlocks: (v) => set({ batchBlocks: v }),

  loadSettings: async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json");
      const provider = await store.get<LLMProviderType>("llmProvider");
      const apiKey = await store.get<string>("llmApiKey");
      const model = await store.get<string>("llmModel");
      const concurrency = await store.get<number>("concurrency");
      const batchBlocks = await store.get<boolean>("batchBlocks");
      set({
        llmProvider: provider ?? "openai",
        llmApiKey: apiKey ?? "",
        llmModel: model ?? "gpt-4.1-mini",
        concurrency: concurrency ?? 3,
        batchBlocks: batchBlocks ?? false,
      });
    } catch {
      // Settings not yet saved, use defaults
    }
  },

  saveSettings: async () => {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json");
    const state = get();
    await store.set("llmProvider", state.llmProvider);
    await store.set("llmApiKey", state.llmApiKey);
    await store.set("llmModel", state.llmModel);
    await store.set("concurrency", state.concurrency);
    await store.set("batchBlocks", state.batchBlocks);
    await store.save();
  },
}));
