import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";
import {
  emptyAnalysis,
  type JournalRecord,
  type TradePlan,
} from "./types";

function makeRecord(
  id: string,
  status: TradePlan["status"],
  result?: TradePlan["result"],
  resultR?: number,
): JournalRecord {
  return {
    id,
    kind: "trade",
    sessionId: "test-session",
    symbol: "US30",
    timeframe: "M1",
    decisionTime: 1000,
    session: "New York",
    analysis: emptyAnalysis(),
    trade: {
      id,
      direction: "long",
      entry: 40000,
      stopLoss: 39900,
      takeProfit: 40200,
      plannedAt: 1000,
      status,
      ...(result !== undefined ? { result } : {}),
      ...(resultR !== undefined ? { resultR } : {}),
    },
    mistakes: "",
    notes: "",
    drawings: [],
    createdAt: Number(id),
  };
}

describe("backtest statistics integrity", () => {
  it("excludes unresolved trades from completed performance", () => {
    const records = [
      makeRecord("1", "closed", "win", 2),
      makeRecord("2", "closed", "loss", -1),
      makeRecord("3", "planned"),
      makeRecord("4", "active"),
    ];

    const stats = computeStats(records);

    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.breakeven).toBe(0);
    expect(stats.winRate).toBe(50);
    expect(stats.totalR).toBe(1);
    expect(stats.avgR).toBe(0.5);
  });

  it("does not treat a closed trade without a result as breakeven", () => {
    const stats = computeStats([
      makeRecord("1", "closed"),
    ]);

    expect(stats.breakeven).toBe(0);
    expect(stats.avgR).toBe(0);
  });
});

describe("missing R handling", () => {
  it("calculates R from a valid exit price", () => {
    const winning = makeRecord("10", "closed", "win");
    winning.trade!.exitPrice = 40200;

    const stats = computeStats([winning]);

    expect(stats.wins).toBe(1);
    expect(stats.totalR).toBe(2);
    expect(stats.avgR).toBe(2);
    expect(stats.avgWin).toBe(2);
  });

  it("does not treat a missing R value as zero", () => {
    const winning = makeRecord("11", "closed", "win", 2);
    const incomplete = makeRecord("12", "closed", "loss");
    const stats = computeStats([winning, incomplete]);

    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBe(50);
    expect(stats.totalR).toBe(2);
    expect(stats.avgR).toBe(2);
    expect(stats.avgWin).toBe(2);
    expect(stats.avgLoss).toBe(0);
  });
});
