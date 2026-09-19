import { aggregateCandles } from "@/lib/market/aggregate";
import type { MarketDataProvider } from "@/lib/market/provider";
import { floorToTf, TF_SECONDS, type Candle, type Symbol, type Timeframe } from "@/lib/market/types";

/**
 * Replay engine core.
 *
 * The replay clock (`horizon`, UTC seconds) is the single source of truth.
 * A candle with open time `t` on timeframe `tf` is COMPLETE when t + tf <= horizon.
 * The candle whose bucket contains `horizon` is FORMING and is built only from
 * lower-timeframe data strictly before `horizon`. Nothing at or after the
 * horizon is ever requested for display.
 */

export const SPEEDS = [0.5, 1, 2, 4, 8, 16] as const;

export interface ReplayView {
  /** completed candles, oldest → newest */
  completed: Candle[];
  /** forming candle for the current bucket, or null if no data yet */
  forming: Candle | null;
  /** first loaded time (for infinite-scroll left) */
  loadedFrom: number;
}

const DAY = 86400;

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
  const safeM1 = m1.filter((c) => c.time < horizon);
  const forming = safeM1.length ? (aggregateCandles(safeM1, tf)[0] ?? null) : null;
  return { completed: safeCompleted, forming, loadedFrom: from };
}

/** Advance the horizon so that exactly one more `tf` candle becomes complete. Skips market gaps. */
export async function nextHorizon(
  provider: MarketDataProvider,
  symbol: Symbol,
  tf: Timeframe,
  horizon: number,
): Promise<number> {
  const tfs = TF_SECONDS[tf];
  const bucket = floorToTf(horizon, tf);
  // Is there any data in the current bucket? (only `time` is consulted, never price)
  const inBucket = await provider.getCandles({ symbol, timeframe: "M1", from: bucket, to: bucket + tfs });
  if (inBucket.length > 0) return bucket + tfs;
  // Gap (weekend / daily break): find the next candle open time.
  const ahead = await provider.getCandles({ symbol, timeframe: tf, from: bucket + tfs, to: bucket + tfs + 4 * DAY });
  const next = ahead[0];
  if (!next) return bucket + tfs; // end of data — just tick
  return next.time + tfs;
}

export async function advanceCandles(
  provider: MarketDataProvider,
  symbol: Symbol,
  tf: Timeframe,
  horizon: number,
  n: number,
): Promise<number> {
  let h = horizon;
  for (let i = 0; i < n; i++) h = await nextHorizon(provider, symbol, tf, h);
  return h;
}

export interface TradeObservation {
  hit: "tp" | "sl" | null;
  hitAt: number | null;
  mfeR: number;
  maeR: number;
  lastPrice: number | null;
}

/** Inspect M1 data between activation and horizon (exclusive) for SL/TP touches. Informational only. */
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
    if (c.time >= horizon) break;
    lastPrice = c.close;
    const fav = trade.direction === "long" ? c.high - trade.entry : trade.entry - c.low;
    const adv = trade.direction === "long" ? trade.entry - c.low : c.high - trade.entry;
    mfe = Math.max(mfe, fav / risk);
    mae = Math.max(mae, adv / risk);
    if (!hit) {
      const slHit = trade.direction === "long" ? c.low <= trade.stopLoss : c.high >= trade.stopLoss;
      const tpHit = trade.direction === "long" ? c.high >= trade.takeProfit : c.low <= trade.takeProfit;
      if (slHit && tpHit) {
        // ambiguous within one minute — conservative: stop first
        hit = "sl";
        hitAt = c.time;
      } else if (slHit) {
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
