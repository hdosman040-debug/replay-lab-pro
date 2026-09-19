import { createContext, useContext } from "react";

export interface CoordApi {
  timeToX: (time: number) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => number;
  yToPrice: (y: number) => number | null;
  /** nearest candle at time */
  candleAt: (time: number) => { time: number; open: number; high: number; low: number; close: number } | null;
  width: number;
  height: number;
  /** seconds per bar for the displayed timeframe */
  barSeconds: number;
  /** visible time range (approx) */
  visibleFrom: number;
  visibleTo: number;
}

export interface ChartCtx {
  coords: CoordApi | null;
  /** bumps whenever geometry changes; overlays re-render on it */
  version: number;
}

export const ChartContext = createContext<ChartCtx>({ coords: null, version: 0 });
export const useChartCtx = () => useContext(ChartContext);
