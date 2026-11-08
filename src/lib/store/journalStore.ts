import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabaseStorage } from "./supabaseStorage";

import type { JournalRecord, ReplaySession } from "@/lib/backtest/types";
import { closedTradeRecord } from "@/lib/backtest/closedTradeRecord";
import type { SessionWindows } from "@/lib/time/ny";

/**
 * Journal repository, persisted through authenticated Supabase storage.
 */
interface JournalState {
  records: JournalRecord[];
  add: (r: JournalRecord) => void;
  recordClosedTrade: (session: ReplaySession, windows: SessionWindows) => string | null;
  update: (id: string, patch: Partial<JournalRecord>) => void;
  remove: (id: string) => void;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set, get) => ({
      records: [],
      add: (r) =>
        set((s) => {
          if (r.kind !== "trade" || !r.trade?.id) {
            return { records: [r, ...s.records] };
          }

          const existing = s.records.find(
            (record) =>
              record.kind === "trade" &&
              record.sessionId === r.sessionId &&
              record.trade?.id === r.trade?.id,
          );

          if (!existing) {
            return { records: [r, ...s.records] };
          }

          return {
            records: s.records.map((record) =>
              record.id === existing.id
                ? {
                    ...r,
                    id: existing.id,
                    createdAt: existing.createdAt,
                  }
                : record,
            ),
          };
        }),
      recordClosedTrade: (session, windows) => {
        const trade = session.trade;
        if (!trade || trade.status !== "closed") return null;
        const previous = get().records.find((record) =>
          record.kind === "trade" && record.sessionId === session.id && record.trade?.id === trade.id,
        );
        // The user may have deliberately deleted this already-archived execution.
        if (!previous && trade.journalRecordId) return trade.journalRecordId;

        const record = closedTradeRecord(session, windows, previous);
        if (!record) return null;
        if (
          previous?.trade?.journalRecordId !== record.id ||
          previous?.beforeSnapshotId !== record.beforeSnapshotId ||
          previous?.afterSnapshotId !== record.afterSnapshotId
        ) {
          get().add(record);
        }
        return record.id;
      },
      update: (id, patch) =>
        set((s) => ({ records: s.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
    }),
    {
      name: "ict-terminal.journal.v1",
      storage: createJSONStorage(() => supabaseStorage),
      skipHydration: true,
    },
  ),
);
