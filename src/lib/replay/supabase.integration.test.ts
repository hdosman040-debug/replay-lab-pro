import { describe, expect, it } from "vitest";
import { supabaseMarketDataProvider } from "../market/supabaseProvider";
import {
  advanceCandles,
  loadReplayView,
} from "./engine";

describe("Real Supabase replay integration", () => {
  const symbol = "US30" as const;
  const timeframe = "M5" as const;

  it("loads a real causal replay view", async () => {
    const horizon = Date.UTC(2016, 9, 27, 3, 0) / 1000;

    const view = await loadReplayView(
      supabaseMarketDataProvider,
      symbol,
      timeframe,
      horizon,
      50,
    );

    expect(view.completed.length).toBeGreaterThan(0);

    for (const candle of view.completed) {
      expect(candle.time + 300).toBeLessThanOrEqual(horizon);
    }

    if (view.forming) {
      expect(view.forming.time).toBeLessThanOrEqual(horizon);
      expect(view.forming.time + 300).toBeGreaterThan(horizon);
    }
  });

  it("advances through real Supabase data without exposing future candles", async () => {
    const start = Date.UTC(2016, 9, 27, 3, 0) / 1000;

    const next = await advanceCandles(
      supabaseMarketDataProvider,
      symbol,
      timeframe,
      start,
      5,
    );

    expect(next).toBeGreaterThan(start);

    const view = await loadReplayView(
      supabaseMarketDataProvider,
      symbol,
      timeframe,
      next,
      50,
    );

    for (const candle of view.completed) {
      expect(candle.time + 300).toBeLessThanOrEqual(next);
    }
  });
});
