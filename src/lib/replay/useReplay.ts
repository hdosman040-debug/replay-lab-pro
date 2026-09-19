import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadReplayView, advanceCandles, type ReplayView } from "./engine";
import type { ReplaySession } from "@/lib/backtest/types";
import { getMarketDataProvider } from "@/lib/market";
import type { Candle, Timeframe } from "@/lib/market/types";

/**
 * Binds a replay session to market data. The session's `currentTime` is the
 * replay clock — nothing at or after it is ever loaded for display.
 */
export function useReplay(
  session: ReplaySession | undefined,
  viewTf: Timeframe,
  lookback: number,
) {
  const [view, setView] = useState<ReplayView | null>(null);
  const [loading, setLoading] = useState(false);
  const symbol = session?.symbol;
  const horizon = session?.currentTime ?? 0;

  useEffect(() => {
    if (!symbol || !horizon) {
      setView(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadReplayView(getMarketDataProvider(), symbol, viewTf, horizon, lookback)
      .then((v) => {
        if (!cancelled) setView(v);
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
  }, [symbol, viewTf, horizon, lookback]);

  const candles = useMemo<Candle[]>(() => {
    if (!view) return [];
    return view.forming ? [...view.completed, view.forming] : view.completed;
  }, [view]);

  const last = candles.length ? candles[candles.length - 1]! : null;

  return { candles, loading, lastCandle: last };
}

/** Advance helper that is safe to call repeatedly (no overlapping requests). */
export function useAdvance(
  session: ReplaySession | undefined,
  viewTf: Timeframe,
  onTime: (t: number) => void,
) {
  const busy = useRef(false);
  const ref = useRef({ session, viewTf, onTime });
  ref.current = { session, viewTf, onTime };

  return useCallback(async (n: number) => {
    const { session: s, viewTf: tf, onTime: cb } = ref.current;
    if (!s || busy.current) return;
    busy.current = true;
    try {
      const t = await advanceCandles(getMarketDataProvider(), s.symbol, tf, s.currentTime, n);
      cb(t);
    } finally {
      busy.current = false;
    }
  }, []);
}
