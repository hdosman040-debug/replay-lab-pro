import { aggregateCandles } from "./aggregate";
import type { MarketDataProvider } from "./provider";
import { TIMEFRAMES, type Candle, type CandleRange, type DatasetInfo, type Symbol, type Timeframe } from "./types";

/**
 * MockMarketDataProvider
 *
 * Deterministic synthetic US30 M1 data generated per UTC day on demand
 * (seeded, so the same date always produces the same candles). Higher
 * timeframes are aggregated from M1. Data is produced lazily per requested
 * range so the app never holds "the whole dataset" in memory — the same
 * access pattern a Supabase-backed provider will use.
 */

const DAY = 86400;
const DATA_START = Date.UTC(2023, 0, 2) / 1000; // Mon 2023-01-02
const DATA_END = Date.UTC(2025, 0, 1) / 1000; // exclusive
const BASE_PRICE = 33200;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd: () => number) {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Is the market open at this UTC second? Closed Fri 21:00 → Sun 22:00 and daily 21:00–22:00 UTC. */
function isOpen(t: number): boolean {
  const d = new Date(t * 1000);
  const dow = d.getUTCDay();
  const h = d.getUTCHours();
  if (dow === 6) return false;
  if (dow === 0 && h < 22) return false;
  if (dow === 5 && h >= 21) return false;
  if (h === 21) return false;
  return true;
}

/** Volatility multiplier by New York hour (approximated with a fixed -4/-5h offset; good enough for mock). */
function volFactorUTC(t: number): number {
  const d = new Date(t * 1000);
  const m = d.getUTCHours() * 60 + d.getUTCMinutes();
  // UTC minutes; NY open ≈ 13:30 UTC (summer) / 14:30 (winter). Use 13:30–14:30 blend.
  if (m >= 13 * 60 + 30 && m < 16 * 60) return 2.6; // NY AM
  if (m >= 16 * 60 && m < 20 * 60) return 1.4; // NY PM
  if (m >= 7 * 60 && m < 13 * 60 + 30) return 1.3; // London
  if (m >= 22 * 60 || m < 7 * 60) return 0.55; // Asia
  return 1;
}

class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock";
  private dayOpenCache: number[] = [];
  private dayCache = new Map<number, Candle[]>();

  private dayOpen(dayIndex: number): number {
    if (this.dayOpenCache.length === 0) this.dayOpenCache.push(BASE_PRICE);
    while (this.dayOpenCache.length <= dayIndex) {
      const i = this.dayOpenCache.length;
      const rnd = mulberry32(1337 + i * 7919);
      const prev = this.dayOpenCache[i - 1] ?? BASE_PRICE;
      const drift = 6 + Math.sin(i / 23) * 25; // slow regime
      const next = prev + drift + gauss(rnd) * 180;
      this.dayOpenCache.push(Math.max(25000, next));
    }
    return this.dayOpenCache[dayIndex] ?? BASE_PRICE;
  }

  private genDay(dayStart: number): Candle[] {
    const cached = this.dayCache.get(dayStart);
    if (cached) return cached;
    const dayIndex = Math.floor((dayStart - DATA_START) / DAY);
    const rnd = mulberry32(99991 + dayIndex * 104729);
    let price = this.dayOpen(dayIndex);
    // intraday narrative: a few sinusoidal drift waves → trends, ranges, sweeps
    const w1 = rnd() * Math.PI * 2;
    const w2 = rnd() * Math.PI * 2;
    const amp1 = 40 + rnd() * 120;
    const amp2 = 20 + rnd() * 60;
    const candles: Candle[] = [];
    for (let i = 0; i < 1440; i++) {
      const t = dayStart + i * 60;
      if (!isOpen(t)) continue;
      const vol = volFactorUTC(t) * (2.2 + rnd() * 1.4);
      const drift =
        (Math.cos(w1 + (i / 1440) * Math.PI * 4) * amp1 + Math.cos(w2 + (i / 1440) * Math.PI * 9) * amp2) / 400;
      const open = price;
      let p = open;
      let high = open;
      let low = open;
      const ticks = 6;
      for (let k = 0; k < ticks; k++) {
        p += gauss(rnd) * vol * 0.55 + drift / ticks;
        if (p > high) high = p;
        if (p < low) low = p;
      }
      // occasional impulse (displacement) candle
      if (rnd() < 0.012) {
        const dir = rnd() < 0.5 ? -1 : 1;
        p += dir * vol * (4 + rnd() * 6);
        if (p > high) high = p;
        if (p < low) low = p;
      }
      // long-wick sweep occasionally
      if (rnd() < 0.02) {
        if (rnd() < 0.5) high += vol * (2 + rnd() * 3);
        else low -= vol * (2 + rnd() * 3);
      }
      const close = p;
      price = close;
      const r = (x: number) => Math.round(x * 10) / 10;
      candles.push({
        time: t,
        open: r(open),
        high: r(Math.max(high, open, close)),
        low: r(Math.min(low, open, close)),
        close: r(close),
        volume: Math.round(80 + rnd() * 400 * volFactorUTC(t)),
      });
    }
    if (this.dayCache.size > 120) {
      const firstKey = this.dayCache.keys().next().value;
      if (firstKey !== undefined) this.dayCache.delete(firstKey);
    }
    this.dayCache.set(dayStart, candles);
    return candles;
  }

  private getM1(from: number, to: number): Candle[] {
    const start = Math.max(from, DATA_START);
    const end = Math.min(to, DATA_END);
    if (end <= start) return [];
    const out: Candle[] = [];
    const firstDay = Math.floor(start / DAY) * DAY;
    for (let d = firstDay; d < end; d += DAY) {
      const day = this.genDay(d);
      for (const c of day) {
        if (c.time >= start && c.time < end) out.push(c);
      }
    }
    return out;
  }

  async getCandles(range: CandleRange): Promise<Candle[]> {
    const { timeframe, from, to } = range;
    if (timeframe === "M1") return this.getM1(from, to);
    // aggregate from M1; buckets are floored, so extend the lower bound to bucket start.
    const m1 = this.getM1(from, to);
    return aggregateCandles(m1, timeframe).filter((c) => c.time >= from && c.time < to);
  }

  async getBounds(_symbol: Symbol, _timeframe: Timeframe) {
    return { earliest: DATA_START + 22 * 3600, latest: DATA_END - 3 * 3600 - 60 };
  }

  async listDatasets(): Promise<DatasetInfo[]> {
    const tradingMinutesPerWeek = 5 * 23 * 60;
    const weeks = (DATA_END - DATA_START) / (7 * DAY);
    return TIMEFRAMES.map((tf) => {
      const per = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240 }[tf];
      return {
        symbol: "US30" as const,
        timeframe: tf,
        status: "ready" as const,
        candleCount: Math.round((tradingMinutesPerWeek * weeks) / per),
        earliest: DATA_START + 22 * 3600,
        latest: DATA_END - 3 * 3600 - 60,
        source: "Synthetic sample (mock provider)",
      };
    });
  }
}

export const mockMarketDataProvider = new MockMarketDataProvider();
