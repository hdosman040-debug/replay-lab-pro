import { create } from "zustand";

import type { Timeframe } from "@/lib/market/types";

export type PanelTab = "workflow" | "analysis" | "trade";
export type PanelSize = "collapsed" | "half" | "full";

/** Transient (non-persisted) UI + playback state. */
interface UIState {
  playing: boolean;
  setPlaying: (v: boolean) => void;
  /** timeframe currently displayed (kept in sync with the replay clock) */
  viewTimeframe: Timeframe | null;
  setViewTimeframe: (tf: Timeframe) => void;
  activeTool: string | null;
  setActiveTool: (id: string | null) => void;
  selectedDrawingId: string | null;
  setSelectedDrawing: (id: string | null) => void;
  panelTab: PanelTab;
  setPanelTab: (t: PanelTab) => void;
  panelSize: PanelSize;
  setPanelSize: (s: PanelSize) => void;
  sheet: null | "newSession" | "sessions" | "jumpTo" | "recordResult" | "noTrade" | "settingsQuick";
  setSheet: (s: UIState["sheet"]) => void;
  crosshairPrice: number | null;
  setCrosshairPrice: (p: number | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  playing: false,
  setPlaying: (playing) => set({ playing }),
  viewTimeframe: null,
  setViewTimeframe: (viewTimeframe) => set({ viewTimeframe }),
  activeTool: null,
  setActiveTool: (activeTool) => set({ activeTool, selectedDrawingId: null }),
  selectedDrawingId: null,
  setSelectedDrawing: (selectedDrawingId) => set({ selectedDrawingId }),
  panelTab: "workflow",
  setPanelTab: (panelTab) => set({ panelTab }),
  panelSize: "collapsed",
  setPanelSize: (panelSize) => set({ panelSize }),
  sheet: null,
  setSheet: (sheet) => set({ sheet }),
  crosshairPrice: null,
  setCrosshairPrice: (crosshairPrice) => set({ crosshairPrice }),
}));
