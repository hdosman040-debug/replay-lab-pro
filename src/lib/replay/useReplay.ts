import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { advanceCandles, canDelta, loadReplayDelta, loadReplayView, type ReplayView } from "./engine";
import type { ReplaySession } from "@/lib/backtest/types";
import { getMarketDataProvider } from "@/lib/market";
import type { Candle, Timeframe } from "@/lib/market/types";

/**
 * Binds a replay session to market data. The session's `currentTime` is the
 * replay clock — nothing at or after it is ever loaded for display.
 *
 * Stepping forward on the same symbol/timeframe only fetches the new candles
 * (delta load); rewinding, jumping or switching timeframe does a full reload.
 */
export function useReplay(
  session: ReplaySession | undefined,
  viewTf: Timeframe,
  lookback: number,
  dataProvider: "mock" | "supabase" = "mock",
) {
  const [view, setView] = useState<ReplayView | null>(null);
  const [loading, setLoading] = useState(false);
  const viewRef = useRef<ReplayView | null>(null);
  const symbol = session?.symbol;
  const horizon = session?.currentTime ?? 0;

  useEffect(() => {
    if (!symbol || !horizon) {
      viewRef.current = null;
      setView(null);
      return;
    }
    let cancelled = false;
    const provider = getMarketDataProvider();
    const prev = viewRef.current;
    const delta = canDelta(prev, symbol, viewTf, horizon);
    // Only show the loading state for full reloads; deltas are near-instant and
    // flashing "loading…" on every replay step is noise.
    if (!delta) setLoading(true);
    const task = delta
      ? loadReplayDelta(provider, prev, horizon)
      : loadReplayView(provider, symbol, viewTf, horizon, lookback);
    task
      .then((v) => {
        if (cancelled) return;
        viewRef.current = v;
        setView(v);
      })
      .catch(() => {
        if (!cancelled) setView(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, viewTf, horizon, lookback, dataProvider]);

  const candles = useMemo<Candle[]>(() => {
    if (!view) return [];

    const completed = view.completed;

    if (!view.forming) {
      return completed;
    }

    const lastCompleted = completed[completed.length - 1];

    // Never expose the same timestamp twice.
    // At an exact timeframe boundary, the candle that was previously
    // forming may now also appear in completed.
    if (lastCompleted && lastCompleted.time === view.forming.time) {
      return completed;
    }

    return [...completed, view.forming];
  }, [view]);

  const last = candles.length ? candles[candles.length - 1]! : null;

  return { candles, loading, lastCandle: last };
}

/** Advance helper that is safe to call repeatedly (no overlapping requests). */
export function useAdvance(session: ReplaySession | undefined, viewTf: Timeframe, onTime: (t: number) => void) {
  const busy = useRef(false);
  const ref = useRef({ session, viewTf, onTime });
  ref.current = { session, viewTf, onTime };

  return useCallback(async (n: number) => {
    const { session: s, viewTf: tf, onTime: cb } = ref.current;
    if (!s || busy.current) return;
    busy.current = true;
    try {
      const provider = getMarketDataProvider();
      console.log("[Replay Advance] provider:", provider.id);
      console.log("[Replay Advance] request:", {
        symbol: s.symbol,
        timeframe: tf,
        horizon: s.currentTime,
        n,
      });

      const t = await advanceCandles(
        provider,
        s.symbol,
        tf,
        s.currentTime,
        n,
      );

      console.log("[Replay Advance] new horizon:", t);
      cb(t);
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.name}: ${error.message}\\n\\n${error.stack ?? ""}`
          : String(error);

      window.alert(`REPLAY +1 ERROR\\n\\n${message}`);

      console.error("[Replay Advance] FAILED:", error);
      throw error;
    } finally {
      busy.current = false;
    }
  }, []);
}
