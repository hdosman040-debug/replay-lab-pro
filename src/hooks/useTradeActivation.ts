import { useEffect } from "react";
import type { ReplaySession } from "@/lib/backtest/types";
import { findActivation } from "@/lib/replay/engine";
import { getMarketDataProvider } from "@/lib/market";
import { useSessionStore } from "@/lib/store/sessionStore";

/**
 * Activates a manually planned trade only after replayed
 * price reaches its entry.
 */
export function useTradeActivation(
  session: ReplaySession | undefined,
) {
  useEffect(() => {
      const trade = session?.trade;
      if (!session || !trade || trade.status !== "planned") return;

      let cancelled = false;

      void (async () => {
        try {
          const provider = getMarketDataProvider();
          const activatedAt = await findActivation(
            provider,
            session.symbol,
            trade,
            trade.plannedAt,
            session.currentTime,
          );

          if (cancelled || activatedAt === null) return;

          const latest = useSessionStore.getState().sessions[session.id]?.trade;
          if (!latest || latest.id !== trade.id || latest.status !== "planned") return;

          useSessionStore.getState().setTrade({
            ...latest,
            status: "active",
            activatedAt,
          });
        } catch (error) {
          console.error("[Trade Activation] FAILED:", error);
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
      session?.trade?.plannedAt,
    ]);
}
