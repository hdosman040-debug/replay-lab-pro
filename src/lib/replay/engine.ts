import { aggregateCandles } from "@/lib/market/aggregate";
import type { MarketDataProvider } from "@/lib/market/provider";
import { floorToTf, TF_SECONDS, type Candle, type Symbol, type Timeframe } from "@/lib/market/types";

/**
 * Replay engine core.
 *
 * The replay clock (`horizon`, UTC seconds) is the single source of truth.
 * A candle with open time `t` on timeframe `tf` is COMPLETE when t + tf <= horizon.
 * The candle whose bucket contains `horizon` is FORMING and is built only from
 * lower-timeframe (M1) candles that have themselves CLOSED before `horizon`
 * (t + 60 <= horizon). A partially elapsed M1 candle carries future OHLC, so it
 * is never used. Nothing at or after the horizon is ever requested for display.
 *
 * Gap skipping (weekend / session break) needs to know *whether* a later candle
 * exists. Only candle timestamps are consulted for that — never prices — so no
 * future price information can reach the chart, the analysis or a trade.
 */

export const SPEEDS = [0.5, 1, 2, 4, 8, 16] as const;

export interface ReplayView {
  /** completed candles, oldest → newest */
  completed: Candle[];
  /** forming candle for the current bucket, or null if no data yet */
  forming: Candle | null;
  /** first loaded time (for infinite-scroll left) */
  loadedFrom: number;
  /** the replay clock this view was built for */
  horizon: number;
  timeframe: Timeframe;
  symbol: Symbol;
}

const DAY = 86400;
const M1S = 60;

/** Build the forming candle from M1 data that has fully closed before `horizon`. */
function buildForming(m1: Candle[], tf: Timeframe, horizon: number): Candle | null {
  const safe = m1.filter((c) => c.time + M1S <= horizon);
  if (safe.length === 0) return null;
  return aggregateCandles(safe, tf)[0] ?? null;
}

/** Load everything visible at `horizon` for `tf`, with roughly `lookback` completed candles. */
export async function loadReplayView(
  provider: MarketDataProvider,
  symbol: Symbol,
  tf: Timeframe,
  horizon: number,
  lookback: number,
): Promise<ReplayView> {
  const tfs = TF_SECONDS[tf];
  const bucket = floorToTf(horizon, tf);
  // pad for weekends / daily breaks so we still get ~lookback candles
  const span = lookback * tfs;
  const from = bucket - span - Math.max(2 * DAY, Math.ceil(span / (5 * DAY)) * 2 * DAY);
  const [completed, m1] = await Promise.all([
    provider.getCandles({ symbol, timeframe: tf, from, to: bucket }),
    horizon > bucket
      ? provider.getCandles({ symbol, timeframe: "M1", from: bucket, to: horizon })
      : Promise.resolve([] as Candle[]),
  ]);
  // Defensive: never trust a provider to respect `to`.
  const safeCompleted = completed.filter((c) => c.time + tfs <= horizon);
  return {
    completed: safeCompleted,
    forming: buildForming(m1, tf, horizon),
    loadedFrom: from,
    horizon,
    timeframe: tf,
    symbol,
  };
}

/**
 * Incremental update of an existing view when the clock only moved forward on
 * the same symbol/timeframe. Avoids refetching (and, for the mock provider,
 * regenerating) the whole lookback window on every replay step.
 */
export async function loadReplayDelta(
  provider: MarketDataProvider,
  prev: ReplayView,
  horizon: number,
): Promise<ReplayView> {
  const tf = prev.timeframe;
  const symbol = prev.symbol;
  const tfs = TF_SECONDS[tf];
  const bucket = floorToTf(horizon, tf);
  const last = prev.completed[prev.completed.length - 1];
  const from = last ? last.time + tfs : bucket;

  let completed = prev.completed;
  if (bucket > from) {
    const fresh = (await provider.getCandles({ symbol, timeframe: tf, from, to: bucket })).filter(
      (c) => c.time >= from && c.time + tfs <= horizon,
    );
    if (fresh.length) completed = prev.completed.concat(fresh);
  }

  const m1 =
    horizon > bucket ? await provider.getCandles({ symbol, timeframe: "M1", from: bucket, to: horizon }) : [];

  return {
    completed,
    forming: buildForming(m1, tf, horizon),
    loadedFrom: prev.loadedFrom,
    horizon,
    timeframe: tf,
    symbol,
  };
}

/** Can `prev` be advanced to `horizon` with a delta load instead of a full reload? */
export function canDelta(prev: ReplayView | null, symbol: Symbol, tf: Timeframe, horizon: number): prev is ReplayView {
  return !!prev && prev.symbol === symbol && prev.timeframe === tf && horizon >= prev.horizon;
}

/** Advance the horizon so that exactly one more `tf` candle becomes complete. Skips market gaps. */
export async function nextHorizon(
  provider: MarketDataProvider,
  symbol: Symbol,
  tf: Timeframe,
  horizon: number,
): Promise<number> {
  return advanceCandles(provider, symbol, tf, horizon, 1);
}

/**
 * Advance the clock by `n` completed candles in a single provider round-trip.
 * Only candle *existence* is used, so gaps (weekend, daily break, end of data)
 * are skipped without consulting any future price.
 */
export async function advanceCandles(
  provider: MarketDataProvider,
  symbol: Symbol,
  tf: Timeframe,
  horizon: number,
  n: number,
): Promise<number> {
  if (n <= 0) return horizon;
  const tfs = TF_SECONDS[tf];
  const bucket = floorToTf(horizon, tf);
  const to = bucket + n * tfs + 4 * DAY;
  const ahead = await provider.getCandles({ symbol, timeframe: tf, from: bucket, to });
  if (ahead.length === 0) return bucket + n * tfs; // no data at all — just tick
  const target = ahead[Math.min(n - 1, ahead.length - 1)]!;
  return target.time + tfs;
}

export interface TradeObservation {
  hit: "tp" | "sl" | null;
  hitAt: number | null;
  mfeR: number;
  maeR: number;
  lastPrice: number | null;
}

/**
 * Inspect M1 data between activation and horizon for SL/TP touches.
 * Informational only — it never decides whether a trade should be taken.
 *
 * Ambiguity rule: when a single M1 candle touches both stop and target, the
 * intrabar order is unknown, so the pessimistic outcome (stop first) is
 * reported. Only M1 candles that closed strictly before the horizon are read.
 */
export async function observeTrade(
  provider: MarketDataProvider,
  symbol: Symbol,
  trade: { direction: "long" | "short"; entry: number; stopLoss: number; takeProfit: number },
  from: number,
  horizon: number,
): Promise<TradeObservation> {
  const m1 = await provider.getCandles({ symbol, timeframe: "M1", from, to: horizon });
  const risk = Math.abs(trade.entry - trade.stopLoss) || 1;
  let mfe = 0;
  let mae = 0;
  let hit: "tp" | "sl" | null = null;
  let hitAt: number | null = null;
  let lastPrice: number | null = null;
  for (const c of m1) {
    if (c.time + M1S > horizon) break; // candle not closed yet at the replay clock
    lastPrice = c.close;
    const fav = trade.direction === "long" ? c.high - trade.entry : trade.entry - c.low;
    const adv = trade.direction === "long" ? trade.entry - c.low : c.high - trade.entry;
    mfe = Math.max(mfe, fav / risk);
    mae = Math.max(mae, adv / risk);
    if (!hit) {
      const slHit = trade.direction === "long" ? c.low <= trade.stopLoss : c.high >= trade.stopLoss;
      const tpHit = trade.direction === "long" ? c.high >= trade.takeProfit : c.low <= trade.takeProfit;
      if (slHit) {
        // ambiguous same-candle case resolves pessimistically to the stop
        hit = "sl";
        hitAt = c.time;
      } else if (tpHit) {
        hit = "tp";
        hitAt = c.time;
      }
      if (hit) break;
    }
  }
  return { hit, hitAt, mfeR: mfe, maeR: mae, lastPrice };
}

/**
 * Has the manually planned entry been reached by the replay clock?
 * Uses only M1 candles closed before `horizon`; returns the activation time or null.
 * The trader defines the level — this only reports when price actually traded there.
 */
export async function findActivation(
  provider: MarketDataProvider,
  symbol: Symbol,
  trade: { entry: number },
  from: number,
  horizon: number,
): Promise<number | null> {
  if (horizon <= from) return null;
  const m1 = await provider.getCandles({ symbol, timeframe: "M1", from, to: horizon });
  for (const c of m1) {
    if (c.time + M1S > horizon) break;
    if (c.low <= trade.entry && c.high >= trade.entry) return c.time;
  }
  return null;
}
