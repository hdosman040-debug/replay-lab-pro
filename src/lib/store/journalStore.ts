import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { JournalRecord } from "@/lib/backtest/types";

/**
 * Journal repository. Persisted locally for now; the shape is flat and
 * serialisable so it can be mirrored to a Supabase `journal_records` table.
 */
interface JournalState {
  records: JournalRecord[];
  add: (r: JournalRecord) => void;
  update: (id: string, patch: Partial<JournalRecord>) => void;
  remove: (id: string) => void;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      records: [],
      add: (r) => set((s) => ({ records: [r, ...s.records] })),
      update: (id, patch) =>
        set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
    }),
    {
      name: "ict-terminal.journal.v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
