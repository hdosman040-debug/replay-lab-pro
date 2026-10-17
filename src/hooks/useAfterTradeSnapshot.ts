import { useEffect, type RefObject } from "react";
import type { CandleChartHandle } from "@/components/chart/CandleChart";
import type { ReplaySession } from "@/lib/backtest/types";
import { uid, useSessionStore } from "@/lib/store/sessionStore";
import { saveSnapshot } from "@/lib/snapshots/snapshotStore";

/**
 * Captures the chart after a manual trade has closed.
 * Retains the existing cancellation and trade identity checks.
 */
export function useAfterTradeSnapshot(
  session: ReplaySession | undefined,
  chartRef: RefObject<CandleChartHandle | null>,
  captureSnapshotClean: () => Promise<Blob>,
) {
    useEffect(() => {
      const trade = session?.trade;

      if (
        !session ||
        !trade ||
        trade.status !== "closed" ||
        !trade.closedAt ||
        trade.afterSnapshotId
      ) {
        return;
      }

      let cancelled = false;

      void (async () => {
        try {
          if (!chartRef.current) return;

          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });

          if (cancelled) return;

          const blob = await captureSnapshotClean();
          const snapshotId = uid();

          await saveSnapshot({
            id: snapshotId,
            blob,
            createdAt: Date.now(),
            kind: "after",
            sessionId: session.id,
          });

          if (cancelled) return;

          const latest = useSessionStore.getState().sessions[session.id]?.trade;

          if (!latest || latest.id !== trade.id || latest.status !== "closed") {
            return;
          }

          useSessionStore.getState().setTrade({
            ...latest,
            afterSnapshotId: snapshotId,
          });
        } catch (error) {
          console.error("[After Snapshot] FAILED:", error);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      session?.id,
      session?.trade?.id,
      session?.trade?.status,
      session?.trade?.closedAt,
      session?.trade?.afterSnapshotId,
      captureSnapshotClean,
    ]);
}
