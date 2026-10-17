import { useEffect } from "react";
import type { ReplaySession } from "@/lib/backtest/types";
import { canRecordTradeOutcome, resultRAt } from "@/lib/backtest/types";
import { observeTrade } from "@/lib/replay/engine";
import { getMarketDataProvider } from "@/lib/market";
import { useSessionStore } from "@/lib/store/sessionStore";

/**
 * Resolves active manual trades against replayed market data.
 * Preserves existing stop/target and stale-result safeguards.
 */
export function useTradeResolution(
  session: ReplaySession | undefined,
) {
  useEffect(() => {
      const trade = session?.trade;
      if (!session || !trade || trade.status !== "active" || !trade.activatedAt) return;

      let cancelled = false;

      void (async () => {
        try {
          const provider = getMarketDataProvider();
          const observation = await observeTrade(
            provider,
            session.symbol,
            trade,
            trade.activatedAt!,
            session.currentTime,
          );

          if (cancelled || !observation.hit || observation.hitAt === null) return;

          const latest = useSessionStore.getState().sessions[session.id]?.trade;

          if (
            !latest ||
            latest.id !== trade.id ||
            latest.status !== "active" ||
            latest.afterSnapshotId
          ) {
            return;
          }

          const exitPrice =
            observation.hit === "tp"
              ? latest.takeProfit
              : latest.stopLoss;

          const resultR = resultRAt(latest, exitPrice);
          const result = observation.hit === "tp" ? "win" : "loss";

          if (!canRecordTradeOutcome(latest, exitPrice, resultR, result)) return;

          useSessionStore.getState().setTrade({
            ...latest,
            status: "closed",
            closedAt: observation.hitAt,
            result,
            exitPrice,
            resultR,
            maxFavorableR: observation.mfeR,
            maxAdverseR: observation.maeR,
            observed: {
              hit: observation.hit,
              at: observation.hitAt,
            },
          });
        } catch (error) {
          console.error("[Trade Resolution] FAILED:", error);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [
      session?.id,
      session?.symbol,
      session?.currentTime,
      session?.trade?.id,
      session?.trade?.status,
      session?.trade?.activatedAt,
    ]);
}
