import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { emptyAnalysis, type Analysis, type ReplaySession, type TradePlan, type WorkflowStepId } from "@/lib/backtest/types";
import type { Drawing } from "@/lib/drawings/types";
import type { Symbol, Timeframe } from "@/lib/market/types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface SessionState {
  sessions: Record<string, ReplaySession>;
  activeSessionId: string | null;
  createSession: (input: {
    name?: string;
    symbol: Symbol;
    timeframe: Timeframe;
    startTime: number;
    speed: number;
  }) => string;
  setActive: (id: string | null) => void;
  deleteSession: (id: string) => void;
  patchSession: (id: string, patch: Partial<ReplaySession>) => void;
  patchActive: (patch: Partial<ReplaySession>) => void;
  /* drawings (with undo / redo) */
  addDrawing: (d: Drawing) => void;
  updateDrawing: (id: string, patch: Partial<Drawing>, commit?: boolean) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  undo: () => void;
  redo: () => void;
  /* analysis / trade / workflow */
  setAnalysis: (fn: (a: Analysis) => Analysis) => void;
  setTrade: (t: TradePlan | null) => void;
  toggleWorkflowStep: (id: WorkflowStepId) => void;
}

/* Undo history is per-session and in-memory only. */
const history: Record<string, { past: Drawing[][]; future: Drawing[][] }> = {};
function hist(id: string) {
  return (history[id] ??= { past: [], future: [] });
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => {
      const active = () => {
        const id = get().activeSessionId;
        return id ? get().sessions[id] : undefined;
      };
      const setDrawings = (drawings: Drawing[], recordHistory: boolean) => {
        const s = active();
        if (!s) return;
        if (recordHistory) {
          const h = hist(s.id);
          h.past.push(s.drawings);
          if (h.past.length > 100) h.past.shift();
          h.future = [];
        }
        get().patchSession(s.id, { drawings });
      };
      return {
        sessions: {},
        activeSessionId: null,
        createSession: ({ name, symbol, timeframe, startTime, speed }) => {
          const id = uid();
          const now = Date.now();
          const session: ReplaySession = {
            id,
            name: name || `${symbol} ${timeframe}`,
            symbol,
            timeframe,
            startTime,
            currentTime: startTime,
            speed,
            drawings: [],
            analysis: emptyAnalysis(),
            trade: null,
            workflowDone: [],
            createdAt: now,
            updatedAt: now,
          };
          set((st) => ({ sessions: { ...st.sessions, [id]: session }, activeSessionId: id }));
          return id;
        },
        setActive: (id) => set({ activeSessionId: id }),
        deleteSession: (id) =>
          set((st) => {
            const sessions = { ...st.sessions };
            delete sessions[id];
            return { sessions, activeSessionId: st.activeSessionId === id ? null : st.activeSessionId };
          }),
        patchSession: (id, patch) =>
          set((st) => {
            const s = st.sessions[id];
            if (!s) return st;
            return { sessions: { ...st.sessions, [id]: { ...s, ...patch, updatedAt: Date.now() } } };
          }),
        patchActive: (patch) => {
          const s = active();
          if (s) get().patchSession(s.id, patch);
        },
        addDrawing: (d) => {
          const s = active();
          if (s) setDrawings([...s.drawings, d], true);
        },
        updateDrawing: (id, patch, commit = true) => {
          const s = active();
          if (!s) return;
          setDrawings(
            s.drawings.map((d) => (d.id === id ? { ...d, ...patch } : d)),
            commit,
          );
        },
        removeDrawing: (id) => {
          const s = active();
          if (s) setDrawings(s.drawings.filter((d) => d.id !== id), true);
        },
        clearDrawings: () => setDrawings([], true),
        undo: () => {
          const s = active();
          if (!s) return;
          const h = hist(s.id);
          const prev = h.past.pop();
          if (!prev) return;
          h.future.push(s.drawings);
          get().patchSession(s.id, { drawings: prev });
        },
        redo: () => {
          const s = active();
          if (!s) return;
          const h = hist(s.id);
          const next = h.future.pop();
          if (!next) return;
          h.past.push(s.drawings);
          get().patchSession(s.id, { drawings: next });
        },
        setAnalysis: (fn) => {
          const s = active();
          if (s) get().patchSession(s.id, { analysis: fn(s.analysis) });
        },
        setTrade: (t) => {
          const s = active();
          if (s) get().patchSession(s.id, { trade: t });
        },
        toggleWorkflowStep: (id) => {
          const s = active();
          if (!s) return;
          const done = s.workflowDone.includes(id)
            ? s.workflowDone.filter((x) => x !== id)
            : [...s.workflowDone, id];
          get().patchSession(s.id, { workflowDone: done });
        },
      };
    },
    {
      name: "ict-terminal.sessions.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export function useActiveSession(): ReplaySession | undefined {
  return useSessionStore((s) => (s.activeSessionId ? s.sessions[s.activeSessionId] : undefined));
}
