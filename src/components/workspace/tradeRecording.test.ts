import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/store/supabaseStorage", () => ({
  supabaseStorage: { getItem: vi.fn(async () => null), setItem: vi.fn(), removeItem: vi.fn() },
}));

// Server rendering normally selects Zustand's empty initial state. Use the
// hydrated snapshot here to check the controls shown to a signed-in trader.
vi.mock("@/lib/store/journalStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store/journalStore")>();
  return {
    ...actual,
    useJournalStore: Object.assign(
      (selector: (state: ReturnType<typeof actual.useJournalStore.getState>) => unknown) =>
        selector(actual.useJournalStore.getState()),
      actual.useJournalStore,
    ),
  };
});

import { TradePanel } from "./panels";
import { RecordResultSheet } from "./sheets";
import { emptyAnalysis, type ReplaySession } from "@/lib/backtest/types";
import { closedTradeRecord } from "@/lib/backtest/closedTradeRecord";
import { useJournalStore } from "@/lib/store/journalStore";
import { DEFAULT_SESSIONS } from "@/lib/time/ny";

const session: ReplaySession = {
  id: "session-1",
  name: "US30",
  symbol: "US30",
  timeframe: "M5",
  startTime: 1000,
  currentTime: 1600,
  speed: 1,
  analysis: emptyAnalysis(),
  drawings: [],
  workflowDone: [],
  createdAt: 1000,
  updatedAt: 2000,
  trade: {
    id: "trade-1",
    direction: "long",
    status: "closed",
    entry: 40000,
    stopLoss: 39900,
    takeProfit: 40200,
    plannedAt: 1000,
    activatedAt: 1060,
    closedAt: 1500,
    resolvedAt: 1600,
    result: "win",
    resultR: 2,
    exitPrice: 40200,
  },
};

beforeEach(() => useJournalStore.setState({ records: [] }));

describe("recorded trade controls", () => {
  it("allows review after an automatic close instead of disabling the result button", () => {
    const html = renderToStaticMarkup(
      createElement(TradePanel, {
        trade: session.trade,
        lastPrice: 40200,
        onCreate: vi.fn(),
        onPatch: vi.fn(),
        onRemove: vi.fn(),
        onRecord: vi.fn(),
        onNoTrade: vi.fn(),
        onCaptureBefore: vi.fn(),
      }),
    );
    const reviewButton = html.match(/<button\b[^>]*>Review result<\/button>/)?.[0];
    expect(reviewButton).toBeDefined();
    expect(reviewButton).not.toContain("disabled");
    expect(html).toContain("Clear closed trade");
    expect(html.match(/<input\b[^>]*disabled[^>]*>/g)).toHaveLength(3);
  });

  it("prefills the saved review and locks the recorded outcome", () => {
    const record = closedTradeRecord(session, DEFAULT_SESSIONS)!;
    useJournalStore.getState().add({ ...record, notes: "Original review", mistakes: "Late entry" });
    const html = renderToStaticMarkup(
      createElement(RecordResultSheet, {
        open: true,
        session,
        sessions: DEFAULT_SESSIONS,
        tz: "America/New_York",
        onClose: vi.fn(),
        onSave: vi.fn(),
      }),
    );

    expect(html).toContain("Original review");
    expect(html).toContain("Late entry");
    expect(html.match(/<button\b[^>]*>Win<\/button>/)?.[0]).toContain("disabled");
    expect(html.match(/<input\b[^>]*value="40200"[^>]*>/)?.[0]).toContain("disabled");
    const saveButton = html.match(/<button\b[^>]*>Save review<\/button>/)?.[0];
    expect(saveButton).toBeDefined();
    expect(saveButton).not.toContain("disabled");
  });
});
