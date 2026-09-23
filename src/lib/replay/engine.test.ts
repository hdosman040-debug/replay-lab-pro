import { describe, expect, it } from "vitest";

import { advanceCandles, canDelta, loadReplayDelta, loadReplayView, observeTrade } from "./engine";
import { mockMarketDataProvider } from "@/lib/market/mockProvider";
import type { MarketDataProvider } from "@/lib/market/provider";
import { floorToTf, TF_SECONDS, TIMEFRAMES, type Candle, type Timeframe } from "@/lib/market/types";

const SYM = "US30" as const;
/** Wed 2024-03-06 15:00 UTC — inside the NY session, away from weekends. */
const T0 = Date.UTC(2024, 2, 6, 15, 0) / 1000;

/** Wraps the provider and records the furthest timestamp ever requested. */
function spy(inner: MarketDataProvider) {
  const state = { maxTo: -Infinity, calls: 0 };
  const p: MarketDataProvider = {
    id: inner.id,
    getCandles: (r) => {
      state.calls++;
      state.maxTo = Math.max(state.maxTo, r.to);
      return inner.getCandles(r);
    },
    getBounds: (s, t) => inner.getBounds(s, t),
    listDatasets: () => inner.listDatasets(),
  };
  return { p, state };
}

function allCandles(v: { completed: Candle[]; forming: Candle | null }) {
  return v.forming ? [...v.completed, v.forming] : v.completed;
}

describe("hindsight protection", () => {
  it.each(TIMEFRAMES)("never exposes a candle that closes after the horizon (%s)", async (tf: Timeframe) => {
    const horizon = T0 + 137; // deliberately mid-candle
    const v = await loadReplayView(mockMarketDataProvider, SYM, tf, horizon, 120);
    for (const c of v.completed) {
      expect(c.time + TF_SECONDS[tf]).toBeLessThanOrEqual(horizon);
    }
    if (v.forming) {
      expect(v.forming.time).toBe(floorToTf(horizon, tf));
      expect(v.forming.time).toBeLessThan(horizon);
    }
  });

  it("forming candle ignores the minute that is still in progress", async () => {
    const tf: Timeframe = "M15";
    const bucket = floorToTf(T0, tf);
    // 7.5 minutes into the bucket: minute 7 has NOT closed yet.
    const horizon = bucket + 7 * 60 + 30;
    const v = await loadReplayView(mockMarketDataProvider, SYM, tf, horizon, 50);
    const closedM1 = (await mockMarketDataProvider.getCandles({
      symbol: SYM,
      timeframe: "M1",
      from: bucket,
      to: bucket + 7 * 60,
    })) as Candle[];
    expect(v.forming).not.toBeNull();
    expect(v.forming!.high).toBe(Math.max(...closedM1.map((c) => c.high)));
    expect(v.forming!.low).toBe(Math.min(...closedM1.map((c) => c.low)));
    expect(v.forming!.close).toBe(closedM1[closedM1.length - 1]!.close);
  });

  it("forming candle equals the completed candle once the bucket closes", async () => {
    const tf: Timeframe = "M5";
    const bucket = floorToTf(T0, tf);
    const mid = await loadReplayView(mockMarketDataProvider, SYM, tf, bucket + TF_SECONDS[tf], 50);
    const closed = mid.completed[mid.completed.length - 1]!;
    expect(closed.time).toBe(bucket);
    const partial = await loadReplayView(mockMarketDataProvider, SYM, tf, bucket + TF_SECONDS[tf] - 60, 50);
    // the partial view must not already know the final OHLC beyond what closed
    expect(partial.forming!.time).toBe(bucket);
    expect(partial.forming!.high).toBeLessThanOrEqual(closed.high);
    expect(partial.forming!.low).toBeGreaterThanOrEqual(closed.low);
  });

  it("advancing never reads prices before they exist for display", async () => {
    // Stepping may look ahead for candle *existence* (gap skipping), but the
    // resulting view must still stop at the new horizon.
    let h = T0;
    let view = await loadReplayView(mockMarketDataProvider, SYM, "M5", h, 60);
    for (let i = 0; i < 12; i++) {
      h = await advanceCandles(mockMarketDataProvider, SYM, "M5", h, 1);
      view = await loadReplayDelta(mockMarketDataProvider, view, h);
      for (const c of allCandles(view)) expect(c.time).toBeLessThan(h);
    }
  });

  it("view loading never requests data beyond the horizon", async () => {
    const { p, state } = spy(mockMarketDataProvider);
    const horizon = T0 + 421;
    await loadReplayView(p, SYM, "M15", horizon, 100);
    expect(state.maxTo).toBeLessThanOrEqual(horizon);
  });

  it("all timeframes agree on the same replay moment", async () => {
    const horizon = T0;
    const views = await Promise.all(
      TIMEFRAMES.map((tf) => loadReplayView(mockMarketDataProvider, SYM, tf, horizon, 80)),
    );
    for (const v of views) {
      const last = allCandles(v).at(-1)!;
      expect(last.time).toBeLessThan(horizon);
      expect(last.time + TF_SECONDS[v.timeframe]).toBeGreaterThanOrEqual(horizon - TF_SECONDS[v.timeframe]);
    }
    // M1 close at the boundary must equal every higher timeframe's last close
    const m1 = allCandles(views[0]!).at(-1)!;
    for (const v of views.slice(1)) {
      expect(allCandles(v).at(-1)!.close).toBe(m1.close);
    }
  });

  it("higher timeframe buckets aggregate exactly from M1", async () => {
    for (const tf of ["M5", "M15", "M30", "H1"] as Timeframe[]) {
      const v = await loadReplayView(mockMarketDataProvider, SYM, tf, T0, 30);
      const c = v.completed.at(-1)!;
      const m1 = await mockMarketDataProvider.getCandles({
        symbol: SYM,
        timeframe: "M1",
        from: c.time,
        to: c.time + TF_SECONDS[tf],
      });
      expect(c.open).toBe(m1[0]!.open);
      expect(c.close).toBe(m1.at(-1)!.close);
      expect(c.high).toBe(Math.max(...m1.map((x) => x.high)));
      expect(c.low).toBe(Math.min(...m1.map((x) => x.low)));
    }
  });
});

describe("replay stepping", () => {
  it("+10 lands on the same clock as ten +1 steps", async () => {
    for (const tf of ["M1", "M5", "H1"] as Timeframe[]) {
      let one = T0;
      for (let i = 0; i < 10; i++) one = await advanceCandles(mockMarketDataProvider, SYM, tf, one, 1);
      const ten = await advanceCandles(mockMarketDataProvider, SYM, tf, T0, 10);
      expect(ten).toBe(one);
    }
  });

  it("+10 costs a single provider round-trip", async () => {
    const { p, state } = spy(mockMarketDataProvider);
    await advanceCandles(p, SYM, "M5", T0, 10);
    expect(state.calls).toBe(1);
  });

  it("skips the weekend gap instead of stalling in dead time", async () => {
    // Friday 2024-03-08 20:55 UTC — market closes at 21:00 and reopens Sunday 22:00.
    const fri = Date.UTC(2024, 2, 8, 20, 55) / 1000;
    const next = await advanceCandles(mockMarketDataProvider, SYM, "M5", fri, 2);
    expect(next).toBeGreaterThan(Date.UTC(2024, 2, 10, 21, 0) / 1000);
    const v = await loadReplayView(mockMarketDataProvider, SYM, "M5", next, 20);
    for (const c of allCandles(v)) expect(c.time).toBeLessThan(next);
  });
});

describe("delta loading", () => {
  it("produces the same view as a full load", async () => {
    const tf: Timeframe = "M5";
    let h = T0;
    let delta = await loadReplayView(mockMarketDataProvider, SYM, tf, h, 100);
    for (let i = 0; i < 6; i++) {
      h = await advanceCandles(mockMarketDataProvider, SYM, tf, h, 1);
      expect(canDelta(delta, SYM, tf, h)).toBe(true);
      delta = await loadReplayDelta(mockMarketDataProvider, delta, h);
    }
    const full = await loadReplayView(mockMarketDataProvider, SYM, tf, h, 100);
    expect(delta.completed.at(-1)).toEqual(full.completed.at(-1));
    expect(delta.forming).toEqual(full.forming);
    // the delta view keeps its history, so it has at least as many candles
    expect(delta.completed.length).toBeGreaterThanOrEqual(full.completed.length - 1);
  });

  it("refuses to delta when rewinding or switching timeframe", async () => {
    const v = await loadReplayView(mockMarketDataProvider, SYM, "M5", T0, 50);
    expect(canDelta(v, SYM, "M5", T0 - 3600)).toBe(false);
    expect(canDelta(v, SYM, "M15", T0 + 3600)).toBe(false);
  });
});

describe("trade observation", () => {
  it("reports the stop when one minute touches both stop and target", async () => {
    const one: Candle = { time: T0, open: 100, high: 110, low: 90, close: 105, volume: 1 };
    const fake: MarketDataProvider = {
      id: "fake",
      getCandles: async () => [one],
      getBounds: async () => ({ earliest: T0, latest: T0 }),
      listDatasets: async () => [],
    };
    const obs = await observeTrade(
      fake,
      SYM,
      { direction: "long", entry: 100, stopLoss: 95, takeProfit: 108 },
      T0,
      T0 + 60,
    );
    expect(obs.hit).toBe("sl");
  });

  it("ignores the minute still in progress", async () => {
    const one: Candle = { time: T0, open: 100, high: 110, low: 90, close: 105, volume: 1 };
    const fake: MarketDataProvider = {
      id: "fake",
      getCandles: async () => [one],
      getBounds: async () => ({ earliest: T0, latest: T0 }),
      listDatasets: async () => [],
    };
    const obs = await observeTrade(
      fake,
      SYM,
      { direction: "long", entry: 100, stopLoss: 95, takeProfit: 108 },
      T0,
      T0 + 30,
    );
    expect(obs.hit).toBeNull();
    expect(obs.lastPrice).toBeNull();
  });
});
