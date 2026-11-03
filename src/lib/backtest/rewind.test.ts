import { describe, expect, it } from "vitest";
import { rewindTrade, type TradePlan } from "./types";

const plannedTrade: TradePlan = {
  id: "rewind-test",
  direction: "long",
  entry: 40000,
  stopLoss: 39900,
  takeProfit: 40200,
  status: "planned",
  plannedAt: 200,
};

describe("trade rewind causality", () => {
  it("removes a trade when rewound before its planning time", () => {
    expect(rewindTrade(plannedTrade, 199)).toBeNull();
  });

  it("keeps a planned trade at its planning time", () => {
    expect(rewindTrade(plannedTrade, 200)).toEqual(plannedTrade);
  });

  it("keeps a planned trade after its planning time", () => {
    expect(rewindTrade(plannedTrade, 300)).toEqual(plannedTrade);
  });

  it("keeps a closed outcome hidden until its resolution time", () => {
    const closedTrade: TradePlan = {
      ...plannedTrade,
      status: "closed",
      activatedAt: 100,
      closedAt: 200,
      resolvedAt: 260,
    };

    expect(rewindTrade(closedTrade, 259)).toMatchObject({
      status: "active",
      activatedAt: 100,
    });
    expect(rewindTrade(closedTrade, 260)).toEqual(closedTrade);
  });
});
