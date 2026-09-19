import type { Candle, CandleRange, DatasetInfo, Symbol, Timeframe } from "./types";

/**
 * MarketDataProvider — the only door between the app and historical data.
 *
 * Implementations must return candles whose open time is within [from, to)
 * and NOTHING beyond `to`. The replay engine relies on this contract to
 * prevent future-data leakage. A SupabaseMarketDataProvider will implement
 * the same interface with range queries against a `candles` table
 * (symbol, timeframe, timestamp, open, high, low, close, volume — UTC).
 */
export interface MarketDataProvider {
  readonly id: string;
  getCandles(range: CandleRange): Promise<Candle[]>;
  /** Time (seconds UTC) of the first / last available candle for a series. */
  getBounds(symbol: Symbol, timeframe: Timeframe): Promise<{ earliest: number; latest: number } | null>;
  listDatasets(): Promise<DatasetInfo[]>;
}
