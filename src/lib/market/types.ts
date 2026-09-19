/** Canonical candle. `time` is the UTC open time in seconds. */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4";

export const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4"];

export const TF_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
};

export type Symbol = "US30";
export const SYMBOLS: Symbol[] = ["US30"];

export interface CandleRange {
  symbol: Symbol;
  timeframe: Timeframe;
  /** inclusive open time (seconds UTC) */
  from: number;
  /** exclusive open time (seconds UTC) */
  to: number;
}

export interface DatasetInfo {
  symbol: Symbol;
  timeframe: Timeframe;
  status: "ready" | "missing" | "loading";
  candleCount: number;
  earliest: number | null;
  latest: number | null;
  source: string;
}

export function floorToTf(time: number, tf: Timeframe): number {
  const s = TF_SECONDS[tf];
  return Math.floor(time / s) * s;
}
