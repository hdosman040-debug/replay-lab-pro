import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  advanceCandles,
  canDelta,
  loadReplayDelta,
  loadReplayHistoryBefore,
  loadReplayView,
  type ReplayView,
} from "./engine";
import type { ReplaySession } from "@/lib/backtest/types";
import {
  getMarketDataProvider,
  setMarketDataProviderById,
} from "@/lib/market";
import type { Candle, Timeframe } from "@/lib/market/types";

const HISTORY_PAGE_SIZE = 300;

export function useReplay(
  session: ReplaySession | undefined,
  viewTf: Timeframe,
  lookback: number,
  dataProvider: "mock" | "supabase" = "mock",
) {
  const [view, setView] = useState<ReplayView | null>(null);

  /*
   * Candles loaded specifically because the user scrolled backward.
   * These are separate from the bounded replay delta buffer.
   */
  const [olderHistory, setOlderHistory] = useState<Candle[]>([]);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const viewRef = useRef<ReplayView | null>(null);
  const historyRef = useRef<Candle[]>([]);
  const historyBusyRef = useRef(false);

  const symbol = session?.symbol;
  const horizon = session?.currentTime ?? 0;

  /*
   * Replay changes:
   *
   * IMPORTANT:
   * Do not clear viewRef on every horizon change.
   * Doing that disables loadReplayDelta().
   *
   * A provider/timeframe/symbol change starts a fresh view.
   */
  useEffect(() => {
    setMarketDataProviderById(dataProvider);

    if (!symbol || !horizon) {
      viewRef.current = null;
      setView(null);
      historyRef.current = [];
      setOlderHistory([]);
      return;
    }

    const existing = viewRef.current;

    const identityChanged =
      !existing ||
      existing.symbol !== symbol ||
      existing.timeframe !== viewTf;

    if (identityChanged) {
      viewRef.current = null;
      historyRef.current = [];
      setOlderHistory([]);
    }

    let cancelled = false;
    const provider = getMarketDataProvider();

    const prev = identityChanged ? null : viewRef.current;
    const delta = canDelta(prev, symbol, viewTf, horizon);

    if (!delta) {
      setLoading(true);
    }

    const task = delta
      ? loadReplayDelta(provider, prev, horizon, lookback)
      : loadReplayView(provider, symbol, viewTf, horizon, lookback);

    task
      .then((v) => {
        if (cancelled) return;

        viewRef.current = v;
        setView(v);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[Replay View] FAILED:", error);
          setView(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, viewTf, horizon, lookback, dataProvider]);

  /*
   * Load older candles when the chart approaches its left edge.
   *
   * This changes only the chart history. It does NOT move the replay clock.
   */
  const loadMoreHistory = useCallback(
    async (fromLogical: number) => {
      const current = viewRef.current;

      if (!current || historyBusyRef.current) return;

      // Only react when the chart is close to the beginning.
      if (fromLogical > 40) return;

      historyBusyRef.current = true;
      setHistoryLoading(true);

      try {
        const provider = getMarketDataProvider();

        const currentHistory = historyRef.current;
        const currentOldest =
          currentHistory.length > 0
            ? currentHistory[0]!.time
            : current.completed[0]?.time ?? 0;

        if (!currentOldest) return;

        const older = await loadReplayHistoryBefore(
          provider,
          current,
          currentOldest,
          HISTORY_PAGE_SIZE,
        );

        if (older.length === 0) return;

        /*
         * Remove duplicates and keep chronological order.
         */
        const existingTimes = new Set(
          [...currentHistory, ...current.completed].map((c) => c.time),
        );

        const uniqueOlder = older.filter((c) => !existingTimes.has(c.time));

        if (uniqueOlder.length === 0) return;

        const merged = [...uniqueOlder, ...currentHistory].sort(
          (a, b) => a.time - b.time,
        );

        historyRef.current = merged;
        setOlderHistory(merged);
      } catch (error) {
        console.error("[Replay History] FAILED:", error);
      } finally {
        historyBusyRef.current = false;
        setHistoryLoading(false);
      }
    },
    [],
  );

  const candles = useMemo<Candle[]>(() => {
    if (!view) return [];

    const completed = view.completed;

    const replayCandles = !view.forming
      ? completed
      : (() => {
          const lastCompleted = completed[completed.length - 1];

          // Never expose the same timestamp twice.
          if (
            lastCompleted &&
            lastCompleted.time === view.forming.time
          ) {
            return completed;
          }

          return [...completed, view.forming];
        })();

    if (olderHistory.length === 0) {
      return replayCandles;
    }

    /*
     * olderHistory contains only candles before the current replay buffer.
     * Keep replayCandles authoritative for the newest portion.
     */
    const replayTimes = new Set(replayCandles.map((c) => c.time));

    const historyOnly = olderHistory.filter(
      (c) => !replayTimes.has(c.time),
    );

    return [...historyOnly, ...replayCandles];
  }, [view, olderHistory]);

  const last = candles.length ? candles[candles.length - 1]! : null;

  return {
    candles,
    loading,
    historyLoading,
    loadMoreHistory,
    lastCandle: last,
  };
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
    const {
      session: s,
      viewTf: tf,
      onTime: cb,
    } = ref.current;

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
          ? `${error.name}: ${error.message}\n\n${error.stack ?? ""}`
          : String(error);

      window.alert(`REPLAY +1 ERROR\n\n${message}`);
      console.error("[Replay Advance] FAILED:", error);
      throw error;
    } finally {
      busy.current = false;
    }
  }, []);
}
