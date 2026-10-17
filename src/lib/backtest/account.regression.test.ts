import { describe, expect, it } from "vitest";
import { computeDemoAccount } from "./account";
import {
  emptyAnalysis,
  type JournalRecord,
  type TradePlan,
} from "./types";

function record(
  id: string,
  status: TradePlan["status"],
  resultR?: number,
): JournalRecord {
  return {
    id,
    kind: "trade",
    sessionId: "account-test",
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
      plannedAt: Number(id),
      status,
      ...(status === "closed"
        ? { result: "win" as const, closedAt: Number(id) }
        : {}),
      ...(resultR !== undefined ? { resultR } : {}),
    },
    mistakes: "",
    notes: "",
    drawings: [],
    createdAt: Number(id),
  };
}

describe("demo account integrity", () => {
  it("excludes unresolved trades even if they contain R values", () => {
    const account = computeDemoAccount([
      record("1", "closed", 2),
      record("2", "active", -1),
      record("3", "planned", 3),
    ]);

    expect(account.balance).toBe(1050);
    expect(account.totalPnl).toBe(50);
    expect(account.points).toHaveLength(2);
    expect(account.points[1]?.resultR).toBe(2);
  });

  it("excludes closed trades without a recorded outcome", () => {
    const incomplete = record("1", "closed", 2);
    delete incomplete.trade!.result;

    const account = computeDemoAccount([incomplete]);

    expect(account.balance).toBe(1000);
    expect(account.points).toHaveLength(1);
  });
});

describe("account and statistics R consistency", () => {
  it("recovers R from a valid exit price for a closed trade", () => {
    const winning = record("10", "closed");
    winning.trade!.exitPrice = 40200;

    const account = computeDemoAccount([winning]);

    expect(account.balance).toBe(1050);
    expect(account.totalPnl).toBe(50);
    expect(account.points).toHaveLength(2);
    expect(account.points[1]?.resultR).toBe(2);
  });

  it("does not calculate R from an invalid exit price", () => {
    const invalid = record("11", "closed");
    invalid.trade!.exitPrice = Number.NaN;

    const account = computeDemoAccount([invalid]);

    expect(account.balance).toBe(1000);
    expect(account.points).toHaveLength(1);
  });
});
