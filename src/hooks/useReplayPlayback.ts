import { useEffect } from "react";
import type { ReplaySession } from "@/lib/backtest/types";

/**
 * Advances the replay clock at the selected playback speed.
 * Does not alter trade execution, candle loading or persistence.
 */
export function useReplayPlayback(
  session: ReplaySession | undefined,
  playing: boolean,
  advance: (count: number) => Promise<void>,
) {
  useEffect(() => {
    const sessionId = session?.id;
    if (!playing || !sessionId) return;

    const speed = session?.speed || 1;

    const id = window.setInterval(
      () => void advance(1),
      Math.max(60, 1000 / speed),
    );

    return () => window.clearInterval(id);
  }, [playing, session?.id, session?.speed, advance]);
}
