import { describe, expect, it } from "vitest";
import { computeDemoAccount } from "./account";
import { computeStats } from "./stats";
import { selectJournalExecutions, uniqueJournalExecutions } from "./uniqueJournalExecutions";
import { emptyAnalysis, type JournalRecord } from "./types";

function tradeRecord(
  id: string,
  tradeId: string,
  resultR: number,
  createdAt: number,
  sessionId = "session-1",
): JournalRecord {
  return {
    id,
    kind: "trade",
    sessionId,
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
      closedAt: 1000,
      status: "closed",
      result: resultR > 0 ? "win" : resultR < 0 ? "loss" : "breakeven",
      resultR,
    },
    mistakes: "",
    notes: "",
    drawings: [],
    createdAt,
  };
}

describe("historical journal execution integrity", () => {
  it("counts repeated saves of one execution only once", () => {
    const records = [
      tradeRecord("record-1", "trade-1", 2, 1000),
      tradeRecord("record-2", "trade-1", 2, 2000),
    ];

    expect(uniqueJournalExecutions(records)).toHaveLength(1);
    expect(computeStats(records).trades).toBe(1);
    expect(computeStats(records).totalR).toBe(2);
    expect(computeDemoAccount(records).balance).toBe(1050);
    expect(computeDemoAccount(records).points).toHaveLength(2);
  });

  it("uses the newer journal record when an outcome was corrected", () => {
    const records = [
      tradeRecord("old", "trade-1", 2, 1000),
      tradeRecord("new", "trade-1", -1, 2000),
    ];

    expect(uniqueJournalExecutions(records)[0]?.id).toBe("new");
    expect(computeStats(records).wins).toBe(0);
    expect(computeStats(records).losses).toBe(1);
    expect(computeStats(records).totalR).toBe(-1);
    expect(computeDemoAccount(records).balance).toBe(975);
  });

  it("keeps different trades from the same session", () => {
    const records = [
      tradeRecord("record-1", "trade-1", 2, 1000),
      tradeRecord("record-2", "trade-2", -1, 2000),
    ];

    expect(computeStats(records).trades).toBe(2);
    expect(computeStats(records).totalR).toBe(1);
    expect(computeDemoAccount(records).balance).toBe(1025);
  });

  it("keeps identical trade IDs from different sessions", () => {
    const records = [
      tradeRecord("record-1", "trade-1", 2, 1000, "session-1"),
      tradeRecord("record-2", "trade-1", -1, 2000, "session-2"),
    ];

    expect(computeStats(records).trades).toBe(2);
    expect(computeDemoAccount(records).balance).toBe(1025);
  });

  it("does not depend on input order for identical IDs and timestamps", () => {
    const winning = tradeRecord("same", "trade-1", 2, 1000);
    const losing = tradeRecord("same", "trade-1", -1, 1000);

    const forward = uniqueJournalExecutions([winning, losing]);
    const reverse = uniqueJournalExecutions([losing, winning]);

    expect(forward).toHaveLength(0);
    expect(reverse).toHaveLength(0);
    expect(computeDemoAccount([winning, losing]).balance).toBe(1000);
    expect(computeStats([winning, losing]).trades).toBe(0);
  });

  it("excludes tied conflicting winners regardless of record order", () => {
    const older = tradeRecord("old", "trade-1", 2, 1000);
    const winning = tradeRecord("same", "trade-1", 2, 2000);
    const losing = tradeRecord("same", "trade-1", -1, 2000);

    for (const records of [
      [older, winning, losing],
      [losing, older, winning],
      [winning, losing, older],
    ]) {
      const selection = selectJournalExecutions(records);

      expect(selection.records).toHaveLength(0);
      expect(selection.ambiguousExecutionCount).toBe(1);
      expect(selection.duplicateRecordCount).toBe(2);
      expect(computeStats(records).trades).toBe(0);
      expect(computeDemoAccount(records).balance).toBe(1000);
    }
  });

  it("preserves no-trade decisions and does not mutate stored records", () => {
    const noTrade: JournalRecord = {
      ...tradeRecord("no-trade-1", "unused", 0, 3000),
      kind: "no_trade",
      trade: null,
      noTradeReason: "no_setup",
    };

    const records = [
      tradeRecord("old", "trade-1", 2, 1000),
      tradeRecord("new", "trade-1", 1, 2000),
      noTrade,
    ];

    const selected = uniqueJournalExecutions(records);

    expect(records).toHaveLength(3);
    expect(selected).toHaveLength(2);
    expect(computeStats(records).total).toBe(2);
    expect(computeStats(records).noTrades).toBe(1);
    expect(computeDemoAccount(records).balance).toBe(1025);
  });
});
