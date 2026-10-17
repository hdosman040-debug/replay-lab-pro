import { describe, expect, it } from "vitest";
import { canRecordTradeOutcome, isValidTradeOutcome, resultRAt } from "./types";

describe("trade risk integrity", () => {
  it("does not classify zero-risk trades as 0R", () => {
    const trade = {
      direction: "long" as const,
      entry: 40000,
      stopLoss: 40000,
    };

    const result = resultRAt(trade, 40200);

    expect(Number.isFinite(result)).toBe(false);
  });

  it("calculates valid R correctly", () => {
    const trade = {
      direction: "long" as const,
      entry: 40000,
      stopLoss: 39900,
    };

    expect(resultRAt(trade, 40200)).toBe(2);
  });
});

describe("trade outcome validation", () => {
  it("rejects zero-risk trades", () => {
    const trade = {
      direction: "long" as const,
      entry: 40000,
      stopLoss: 40000,
    };

    expect(isValidTradeOutcome(trade, 40200)).toBe(false);
  });

  it("rejects non-finite prices", () => {
    const trade = {
      direction: "long" as const,
      entry: 40000,
      stopLoss: 39900,
    };

    expect(isValidTradeOutcome(trade, NaN)).toBe(false);
    expect(isValidTradeOutcome(trade, Infinity)).toBe(false);
  });

  it("accepts a valid trade outcome", () => {
    const trade = {
      direction: "long" as const,
      entry: 40000,
      stopLoss: 39900,
    };

    expect(isValidTradeOutcome(trade, 40200)).toBe(true);
    expect(isValidTradeOutcome(trade, 40000)).toBe(true);
  });
});


describe("trade recording eligibility", () => {
  const validTrade = {
    direction: "long" as const,
    entry: 40000,
    stopLoss: 39900,
  };

  it("accepts a valid closed trade outcome", () => {
    expect(canRecordTradeOutcome(validTrade, 40200, 2, "win")).toBe(true);
  });

  it("rejects zero-risk outcomes", () => {
    const invalidTrade = { ...validTrade, stopLoss: 40000 };
    expect(canRecordTradeOutcome(invalidTrade, 40200, 0, "win")).toBe(false);
  });

  it("rejects non-finite R values", () => {
    expect(canRecordTradeOutcome(validTrade, 40200, NaN, "win")).toBe(false);
    expect(canRecordTradeOutcome(validTrade, 40200, Infinity, "win")).toBe(false);
  });

  it("rejects missing manual results", () => {
    expect(canRecordTradeOutcome(validTrade, 40200, 2, null)).toBe(false);
  });

  it("accepts a valid breakeven result", () => {
    expect(canRecordTradeOutcome(validTrade, 40000, 0, "breakeven")).toBe(true);
  });
});
