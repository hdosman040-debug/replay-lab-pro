import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Timeframe } from "@/lib/market/types";
import { DEFAULT_SESSIONS, DEFAULT_TZ, type SessionWindows } from "@/lib/time/ny";

export interface Settings {
  theme: "dark";
  defaultTimeframe: Timeframe;
  defaultSpeed: number;
  sessionTimezone: string;
  sessions: SessionWindows;
  showSessions: boolean;
  showTradingWindow: boolean;
  showVolume: boolean;
  magnetToOHLC: boolean;
  keepToolActive: boolean;
  lookbackCandles: number;
  traderName: string;
  dataProvider: "mock" | "supabase";
}

interface SettingsState {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  defaultTimeframe: "M5",
  defaultSpeed: 2,
  sessionTimezone: DEFAULT_TZ,
  sessions: DEFAULT_SESSIONS,
  showSessions: true,
  showTradingWindow: true,
  showVolume: false,
  magnetToOHLC: true,
  keepToolActive: false,
  lookbackCandles: 300,
  traderName: "",
  dataProvider: "mock",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "ict-terminal.settings.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        settings: { ...current.settings, ...((persisted as Partial<SettingsState>)?.settings ?? {}) },
      }),
    },
  ),
);
