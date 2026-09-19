import { floorToTf, type Candle, type Timeframe } from "./types";

/** Aggregate lower-timeframe candles into `tf` buckets (bucket = open time floored to tf). */
export function aggregateCandles(candles: Candle[], tf: Timeframe): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  for (const c of candles) {
    const bucket = floorToTf(c.time, tf);
    if (!cur || cur.time !== bucket) {
      if (cur) out.push(cur);
      cur = { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else {
      if (c.high > cur.high) cur.high = c.high;
      if (c.low < cur.low) cur.low = c.low;
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}
