import { describe, expect, it } from "vitest";
import { supabaseMarketDataProvider } from "./supabaseProvider";

describe("Supabase market data smoke test", () => {
  it("loads real US30 M1 data", async () => {
    const from = Date.UTC(2016, 9, 27, 2, 0) / 1000;
    const to = from + 60 * 60;

    const candles = await supabaseMarketDataProvider.getCandles({
      symbol: "US30",
      timeframe: "M1",
      from,
      to,
    });

    expect(candles.length).toBeGreaterThan(0);

    for (const candle of candles) {
      expect(candle.time).toBeGreaterThanOrEqual(from);
      expect(candle.time).toBeLessThan(to);
      expect(Number.isFinite(candle.open)).toBe(true);
      expect(Number.isFinite(candle.high)).toBe(true);
      expect(Number.isFinite(candle.low)).toBe(true);
      expect(Number.isFinite(candle.close)).toBe(true);
    }

    expect(candles[0]!.time).toBeGreaterThanOrEqual(from);
    expect(candles.at(-1)!.time).toBeLessThan(to);
  });

  it("aggregates real M1 data into M5", async () => {
    const from = Date.UTC(2016, 9, 27, 2, 0) / 1000;
    const to = from + 60 * 60;

    const candles = await supabaseMarketDataProvider.getCandles({
      symbol: "US30",
      timeframe: "M5",
      from,
      to,
    });

    expect(candles.length).toBeGreaterThan(0);

    for (const candle of candles) {
      expect(candle.time).toBeGreaterThanOrEqual(from);
      expect(candle.time + 300).toBeLessThanOrEqual(to);
    }
  });

  it("aggregates real M1 data into M15", async () => {
    const from = Date.UTC(2016, 9, 27, 2, 0) / 1000;
    const to = from + 2 * 60 * 60;

    const candles = await supabaseMarketDataProvider.getCandles({
      symbol: "US30",
      timeframe: "M15",
      from,
      to,
    });

    expect(candles.length).toBeGreaterThan(0);

    for (const candle of candles) {
      expect(candle.time).toBeGreaterThanOrEqual(from);
      expect(candle.time + 900).toBeLessThanOrEqual(to);
    }
  });

  it("respects the [from, to) range contract", async () => {
    const from = Date.UTC(2016, 9, 27, 12, 0) / 1000;
    const to = from + 15 * 60;

    const candles = await supabaseMarketDataProvider.getCandles({
      symbol: "US30",
      timeframe: "M1",
      from,
      to,
    });

    for (const candle of candles) {
      expect(candle.time).toBeGreaterThanOrEqual(from);
      expect(candle.time).toBeLessThan(to);
    }
  });
});
