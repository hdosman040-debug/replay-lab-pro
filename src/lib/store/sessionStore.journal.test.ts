import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabaseStorage", () => ({
  supabaseStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import { type TradePlan } from "../backtest/types";
import { useJournalStore } from "./journalStore";
import { recoverClosedTrades, useSessionStore } from "./sessionStore";
import { computeStats } from "../backtest/stats";
import { computeDemoAccount } from "../backtest/account";

const entryTime = Date.parse("2024-01-09T14:45:00Z") / 1000;
const activeTrade: TradePlan = {
  id: "trade-1",
  direction: "long",
  entry: 40000,
  stopLoss: 39900,
  takeProfit: 40200,
  status: "active",
  plannedAt: entryTime,
  activatedAt: entryTime + 60,
};

function startSession() {
  const store = useSessionStore.getState();
  const id = store.createSession({
    symbol: "US30",
    timeframe: "M5",
    startTime: entryTime,
    speed: 1,
  });
  store.patchSession(id, { currentTime: entryTime + 600, trade: activeTrade });
  return id;
}

function closeTrade(sessionId: string, patch: Partial<TradePlan> = {}) {
  useSessionStore.getState().patchSession(sessionId, {
    trade: {
      ...activeTrade,
      status: "closed",
      closedAt: entryTime + 300,
      resolvedAt: entryTime + 600,
      result: "win",
      exitPrice: 40200,
      resultR: 2,
      ...patch,
    },
  });
}

beforeEach(() => {
  useSessionStore.setState({ sessions: {}, activeSessionId: null });
  useJournalStore.setState({ records: [] });
});

describe("closed-trade journal recording", () => {
  it("records a replay TP automatically and keeps it after the plan is cleared", () => {
    const id = startSession();
    expect(useJournalStore.getState().records).toHaveLength(0);
    closeTrade(id);
    useSessionStore.getState().setTrade(null);

    expect(useJournalStore.getState().records).toHaveLength(1);
    expect(useJournalStore.getState().records[0]).toMatchObject({
      sessionId: id,
      trade: { status: "closed", result: "win", resultR: 2 },
    });
  });

  it.each([
    { result: "loss" as const, exitPrice: 39900, resultR: -1 },
    { result: "breakeven" as const, exitPrice: 40000, resultR: 0 },
    {
      direction: "short" as const,
      stopLoss: 40100,
      takeProfit: 39800,
      result: "win" as const,
      exitPrice: 39800,
      resultR: 2,
    },
  ])("records a valid $result outcome for either direction", (outcome) => {
    closeTrade(startSession(), outcome);
    expect(useJournalStore.getState().records[0]?.trade).toMatchObject(outcome);
  });

  it("updates late screenshots without duplicating an execution or erasing its review", () => {
    const id = startSession();
    closeTrade(id);
    const original = useJournalStore.getState().records[0]!;
    useJournalStore
      .getState()
      .update(original.id, { notes: "Waited for MSS", mistakes: "Late entry" });
    useSessionStore
      .getState()
      .setAnalysis((analysis) => ({ ...analysis, dol: "Changed after the trade" }));
    const closed = useSessionStore.getState().sessions[id]!.trade!;
    useSessionStore.getState().patchSession(id, {
      trade: { ...closed, afterSnapshotId: "after-1" },
    });
    useSessionStore.getState().patchSession(id, {
      trade: { ...closed, afterSnapshotId: "after-1" },
    });

    const records = useJournalStore.getState().records;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      notes: "Waited for MSS",
      mistakes: "Late entry",
      afterSnapshotId: "after-1",
      trade: { afterSnapshotId: "after-1" },
      analysis: { dol: "" },
      decisionTime: entryTime,
      session: "New York",
    });
    expect(computeStats(records)).toMatchObject({ trades: 1, wins: 1, totalR: 2 });
    expect(computeDemoAccount(records)).toMatchObject({ balance: 1050 });
  });

  it("recovers an unjournaled closure from an older saved session exactly once", () => {
    const id = startSession();
    closeTrade(id);
    const session = useSessionStore.getState().sessions[id]!;
    const { journalRecordId, ...legacyTrade } = session.trade!;
    useJournalStore.setState({ records: [] });
    useSessionStore.setState({ sessions: { [id]: { ...session, trade: legacyTrade } } });

    recoverClosedTrades();
    recoverClosedTrades();
    expect(useJournalStore.getState().records).toHaveLength(1);
    expect(useSessionStore.getState().sessions[id]!.trade?.journalRecordId).toBe(
      useJournalStore.getState().records[0]!.id,
    );
  });

  it("keeps manually recorded notes and journal identity on closure", () => {
    const id = startSession();
    closeTrade(id);
    const original = useJournalStore.getState().records[0]!;
    useJournalStore.setState({
      records: [{ ...original, id: "manual-record", notes: "My review" }],
    });
    closeTrade(id);
    expect(useJournalStore.getState().records).toHaveLength(1);
    expect(useJournalStore.getState().records[0]).toMatchObject({
      id: "manual-record",
      notes: "My review",
    });
  });

  it("does not restore an intentionally deleted record during recovery or a snapshot update", () => {
    const id = startSession();
    closeTrade(id);
    useJournalStore.getState().remove(useJournalStore.getState().records[0]!.id);
    recoverClosedTrades();
    const trade = useSessionStore.getState().sessions[id]!.trade!;
    useSessionStore.getState().patchSession(id, { trade: { ...trade, afterSnapshotId: "late" } });
    expect(useJournalStore.getState().records).toHaveLength(0);
  });

  it("archives the correct session when another session is selected", () => {
    const first = startSession();
    const second = startSession();
    closeTrade(first);
    expect(useSessionStore.getState().activeSessionId).toBe(second);
    expect(useSessionStore.getState().sessions[second]!.trade?.status).toBe("active");
    expect(useJournalStore.getState().records[0]?.sessionId).toBe(first);
  });

  it.each([
    { resultR: -1 },
    { resultR: 1 },
    { activatedAt: NaN },
    { activatedAt: entryTime - 60 },
    { closedAt: entryTime + 1000 },
    { resolvedAt: entryTime + 1000 },
    { takeProfit: 39800 },
  ])("does not archive an invalid or future outcome: %j", (invalid) => {
    closeTrade(startSession(), invalid);
    expect(useJournalStore.getState().records).toHaveLength(0);
  });

  it("removes the closure marker on rewind and keeps one original execution on replay", () => {
    const id = startSession();
    closeTrade(id);
    useSessionStore.getState().patchSession(id, { currentTime: entryTime + 120 });
    const rewound = useSessionStore.getState().sessions[id]!.trade!;
    expect(rewound.status).toBe("active");
    expect(rewound.journalRecordId).toBeUndefined();
    expect(rewound.result).toBeUndefined();

    useSessionStore.getState().patchSession(id, { currentTime: entryTime + 600 });
    closeTrade(id);
    expect(useJournalStore.getState().records).toHaveLength(1);
  });
});
