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
export function useReplay(session: ReplaySession | undefined, viewTf: Timeframe, lookback: number) {
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
  }, [symbol, viewTf, horizon, lookback]);

  const candles = useMemo<Candle[]>(() => {
    if (!view) return [];
    return view.forming ? [...view.completed, view.forming] : view.completed;
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
      const t = await advanceCandles(getMarketDataProvider(), s.symbol, tf, s.currentTime, n);
      cb(t);
    } finally {
      busy.current = false;
    }
  }, []);
}
