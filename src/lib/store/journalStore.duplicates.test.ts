import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabaseStorage", () => ({
  supabaseStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
    removeItem: vi.fn(async () => {}),
  },
}));

import { emptyAnalysis, type JournalRecord } from "../backtest/types";
import { useJournalStore } from "./journalStore";

function makeRecord(recordId: string, tradeId: string, resultR: number): JournalRecord {
  return {
    id: recordId,
    kind: "trade",
    sessionId: "session-1",
    symbol: "US30",
    timeframe: "M1",
    decisionTime: 1000,
    session: "New York",
    analysis: emptyAnalysis(),
    trade: {
      id: tradeId,
      direction: "long",
      entry: 40000,
      stopLoss: 39900,
      takeProfit: 40200,
      plannedAt: 900,
      activatedAt: 950,
      closedAt: 1000,
      status: "closed",
      result: resultR > 0 ? "win" : "loss",
      resultR,
    },
    mistakes: "",
    notes: "",
    drawings: [],
    createdAt: 1000,
  };
}

describe("journal duplicate execution protection", () => {
  beforeEach(() => {
    useJournalStore.setState({ records: [] });
  });

  it("updates an existing execution instead of inserting a duplicate", () => {
    const first = makeRecord("record-1", "trade-1", 2);
    const second = {
      ...makeRecord("record-2", "trade-1", 1),
      createdAt: 2000,
      notes: "Updated review",
    };

    useJournalStore.getState().add(first);
    useJournalStore.getState().add(second);

    const records = useJournalStore.getState().records;

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("record-1");
    expect(records[0]?.createdAt).toBe(1000);
    expect(records[0]?.trade?.resultR).toBe(1);
    expect(records[0]?.notes).toBe("Updated review");
  });

  it("allows different executions in the same session", () => {
    useJournalStore.getState().add(makeRecord("record-1", "trade-1", 2));

    useJournalStore.getState().add(makeRecord("record-2", "trade-2", -1));

    expect(useJournalStore.getState().records).toHaveLength(2);
  });

  it("does not overwrite an execution from another session", () => {
    useJournalStore.getState().add(makeRecord("record-1", "trade-1", 2));

    useJournalStore.getState().add({
      ...makeRecord("record-2", "trade-1", -1),
      sessionId: "session-2",
    });

    expect(useJournalStore.getState().records).toHaveLength(2);
  });
});
