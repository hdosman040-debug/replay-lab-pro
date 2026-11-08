import { canRecordTradeOutcome, resultRAt, type JournalRecord, type ReplaySession } from "./types";
import { sessionAt, SESSION_LABEL, type SessionWindows } from "@/lib/time/ny";

/** Archive only a valid outcome already visible at this session's replay clock. */
export function closedTradeRecord(
  session: ReplaySession,
  windows: SessionWindows,
  previous?: JournalRecord,
): JournalRecord | null {
  const trade = session.trade;
  if (!trade || trade.status !== "closed") return null;

  const { activatedAt, closedAt, exitPrice, resultR, result } = trade;
  const resolvedAt = trade.resolvedAt ?? closedAt;
  if (
    activatedAt === undefined ||
    closedAt === undefined ||
    resolvedAt === undefined ||
    exitPrice === undefined ||
    resultR === undefined ||
    result === undefined ||
    ![trade.plannedAt, activatedAt, closedAt, resolvedAt, session.currentTime].every(
      Number.isFinite,
    ) ||
    trade.plannedAt > activatedAt ||
    activatedAt > closedAt ||
    closedAt > resolvedAt ||
    resolvedAt > session.currentTime ||
    !canRecordTradeOutcome({ ...trade, status: "active" }, exitPrice, resultR, result) ||
    Math.abs(resultRAt(trade, exitPrice) - resultR) > 1e-8
  ) {
    return null;
  }

  const id = previous?.id ?? trade.journalRecordId ?? `trade-${session.id}-${trade.id}`;
  const beforeSnapshotId =
    previous?.beforeSnapshotId ?? previous?.trade?.beforeSnapshotId ?? trade.beforeSnapshotId;
  const afterSnapshotId =
    previous?.afterSnapshotId ?? previous?.trade?.afterSnapshotId ?? trade.afterSnapshotId;

  // Repeated closure/snapshot updates must keep the original execution and review.
  return {
    ...(previous ?? {
      id,
      kind: "trade" as const,
      sessionId: session.id,
      symbol: session.symbol,
      timeframe: session.timeframe,
      decisionTime: trade.plannedAt,
      session: SESSION_LABEL[sessionAt(activatedAt, windows)],
      analysis: session.analysis,
      ...(session.preTradeChecklist ? { preTradeChecklist: session.preTradeChecklist } : {}),
      mistakes: "",
      notes: "",
      drawings: session.drawings,
      createdAt: Date.now(),
    }),
    trade: {
      ...(previous?.trade ?? trade),
      journalRecordId: id,
      ...(beforeSnapshotId ? { beforeSnapshotId } : {}),
      ...(afterSnapshotId ? { afterSnapshotId } : {}),
    },
    ...(beforeSnapshotId ? { beforeSnapshotId } : {}),
    ...(afterSnapshotId ? { afterSnapshotId } : {}),
  };
}
