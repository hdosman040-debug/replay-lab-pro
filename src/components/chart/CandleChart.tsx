import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { toPng } from "html-to-image";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ChartContext, type CoordApi } from "./chartContext";
import type { Candle } from "@/lib/market/types";
import { fmtDate, fmtTime, zonedParts } from "@/lib/time/ny";

interface Props {
  candles: Candle[];
  barSeconds: number;
  timezone: string;
  onClickEmpty?: () => void;
  onVisibleRangeChange?: (fromLogical: number) => void;
  onCrosshairPrice?: (price: number | null) => void;
  children?: ReactNode;
}

export interface CandleChartHandle {
  captureSnapshot: () => Promise<Blob>;
}

/**
 * lightweight-charts has its own colour parser that only understands
 * hex / rgb(a) / hsl(a) / named colours. Our design tokens are `oklch(...)`,
 * so every value must be rasterised to rgba() before it reaches the chart.
 */
let paintCtx: CanvasRenderingContext2D | null = null;
function toRgb(value: string, fallback: string): string {
  if (!value) return fallback;
  if (/^(#|rgb|hsl)/i.test(value)) return value;
  try {
    if (!paintCtx) {
      const cv = document.createElement("canvas");
      cv.width = 1;
      cv.height = 1;
      paintCtx = cv.getContext("2d", { willReadFrequently: true });
    }
    if (!paintCtx) return fallback;
    paintCtx.clearRect(0, 0, 1, 1);
    paintCtx.fillStyle = "#000";
    paintCtx.fillStyle = value;
    if (paintCtx.fillStyle === "#000" && value !== "#000") {
      // browser rejected the value outright
      return fallback;
    }
    paintCtx.clearRect(0, 0, 1, 1);
    paintCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paintCtx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${((a ?? 255) / 255).toFixed(3)})`;
  } catch {
    return fallback;
  }
}

function cssVar(name: string, fallback = "#808080") {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return toRgb(raw, fallback);
}

export const CandleChart = forwardRef<CandleChartHandle, Props>(function CandleChart(
  {
    candles,
    barSeconds,
    timezone,
    onClickEmpty,
    onVisibleRangeChange,
    onCrosshairPrice,
    children,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const prevRef = useRef<Candle[]>([]);
  const candlesRef = useRef<Candle[]>(candles);
  candlesRef.current = candles;
  const [version, setVersion] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const cbRef = useRef({ onClickEmpty, onVisibleRangeChange, onCrosshairPrice });
  cbRef.current = { onClickEmpty, onVisibleRangeChange, onCrosshairPrice };
  const tzRef = useRef(timezone);
  tzRef.current = timezone;

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot: async () => {
        const root = chartRootRef.current;

        if (!root) {
          throw new Error("Chart is not mounted.");
        }

        // Wait one frame so the chart canvas/SVG overlays are fully painted.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

        const dataUrl = await toPng(root, {
          cacheBust: true,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          backgroundColor: getComputedStyle(root).backgroundColor || "#070A0F",
        });

        const response = await fetch(dataUrl);
        return await response.blob();
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const bg = cssVar("--surface", "#14161a");
    const text = cssVar("--muted-foreground", "#8b93a1");
    const grid = cssVar("--chart-grid", "#22262d");
    const border = cssVar("--border", "#2a2f38");
    const bull = cssVar("--bull", "#2fbf94");
    const bear = cssVar("--bear", "#f2555a");
    const cross = cssVar("--foreground", "#e6e9ef");
    const surface3 = cssVar("--surface-3", "#2a2f38");

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: text,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.08, bottom: 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 7,
        minBarSpacing: 1.5,
        tickMarkFormatter: (t: UTCTimestamp) => {
          const p = zonedParts(t, tzRef.current);
          if (p.hour === 0 && p.minute === 0) return `${p.day}/${p.month}`;
          return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
        },
      },
      localization: {
        timeFormatter: (t: UTCTimestamp) => `${fmtDate(t, tzRef.current)} ${fmtTime(t, tzRef.current)}`,
        priceFormatter: (p: number) => p.toFixed(1),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: cross, width: 1, style: 3, labelBackgroundColor: surface3 },
        horzLine: { color: cross, width: 1, style: 3, labelBackgroundColor: surface3 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
      kineticScroll: { touch: true, mouse: false },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: bull,
      downColor: bear,
      borderUpColor: bull,
      borderDownColor: bear,
      wickUpColor: bull,
      wickDownColor: bear,
      priceLineVisible: true,
      priceLineWidth: 1,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const bump = () => setVersion((v) => v + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      bump();
      if (r) cbRef.current.onVisibleRangeChange?.(r.from);
    });
    chart.subscribeClick(() => cbRef.current.onClickEmpty?.());
    chart.subscribeCrosshairMove((p) => {
      if (!p.point || !seriesRef.current) {
        cbRef.current.onCrosshairPrice?.(null);
        return;
      }
      cbRef.current.onCrosshairPrice?.(seriesRef.current.coordinateToPrice(p.point.y));
    });
    const ro = new ResizeObserver(() => {
      const w = chart.timeScale().width();
      const h = chart.paneSize().height;
      setSize({ width: w, height: h });
      bump();
    });
    ro.observe(el);
    // price scale changes (autoscale) don't emit events — poll cheaply while mounted
    const iv = window.setInterval(bump, 250);

    return () => {
      ro.disconnect();
      window.clearInterval(iv);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      prevRef.current = [];
    };
  }, []);

  // Feed the complete causal candle set to the chart.
  // Replay advances trim candles from the left, so the newest candle
  // must remain visible. History loading prepends candles, so that
  // operation preserves the user's existing viewport.
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const prev = prevRef.current;

    const toBar = (c: Candle) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    });

    const keepRange = chart.timeScale().getVisibleLogicalRange();
    const first = candles[0];
    const prevFirst = prev[0];

    // Replay lookback trimming:
    // the new first candle is later than the old first candle.
    // Follow the newest candle instead of restoring a stale viewport.
    const replayTrim =
      prev.length > 0 &&
      first !== undefined &&
      prevFirst !== undefined &&
      first.time > prevFirst.time;

    // History was prepended:
    // preserve the same candles on screen by shifting their logical
    // positions to account for the newly inserted candles.
    const historyPrepended =
      prev.length > 0 &&
      first !== undefined &&
      prevFirst !== undefined &&
      first.time < prevFirst.time;

    series.setData(candles.map(toBar));

    if (prev.length === 0) {
      // Initial load.
      chart.timeScale().scrollToPosition(6, false);
    } else if (replayTrim) {
      // Replay is moving forward and the lookback window is sliding.
      // Always keep the current/latest candle visible.
      chart.timeScale().scrollToPosition(6, false);
    } else if (historyPrepended && keepRange) {
      const shift = countBefore(candles, prevFirst!.time);

      if (shift > 0) {
        chart.timeScale().setVisibleLogicalRange({
          from: keepRange.from + shift,
          to: keepRange.to + shift,
        });
      }
    }

    prevRef.current = candles;
    setVersion((v) => v + 1);

    const w = chart.timeScale().width();
    const h = chart.paneSize().height;
    if (w !== size.width || h !== size.height) {
      setSize({ width: w, height: h });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles]);

  const coords = useMemo<CoordApi | null>(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || size.width === 0) return null;
    const cs = candlesRef.current;
    const ts = chart.timeScale();
    const n = cs.length;
    const timeToLogical = (t: number): number => {
      if (n === 0) return 0;
      const firstC = cs[0]!;
      const lastC = cs[n - 1]!;
      if (t <= firstC.time) return (t - firstC.time) / barSeconds;
      if (t >= lastC.time) return n - 1 + (t - lastC.time) / barSeconds;
      let lo = 0;
      let hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cs[mid]!.time <= t) lo = mid;
        else hi = mid;
      }
      const a = cs[lo]!.time;
      const b = cs[hi]!.time;
      return lo + (t - a) / (b - a);
    };
    const logicalToTime = (l: number): number => {
      if (n === 0) return 0;
      const firstC = cs[0]!;
      const lastC = cs[n - 1]!;
      if (l <= 0) return firstC.time + l * barSeconds;
      if (l >= n - 1) return lastC.time + (l - (n - 1)) * barSeconds;
      const i = Math.floor(l);
      const a = cs[i]!.time;
      const b = cs[i + 1]!.time;
      return a + (l - i) * (b - a);
    };
    const range = ts.getVisibleLogicalRange();
    return {
      width: size.width,
      height: size.height,
      barSeconds,
      visibleFrom: range ? logicalToTime(range.from) : 0,
      visibleTo: range ? logicalToTime(range.to) : 0,
      timeToX: (t) => {
        const x = ts.logicalToCoordinate(timeToLogical(t) as never);
        return x === null ? null : (x as number);
      },
      priceToY: (p) => {
        const y = series.priceToCoordinate(p);
        return y === null ? null : (y as number);
      },
      xToTime: (x) => {
        const l = ts.coordinateToLogical(x);
        return logicalToTime(l === null ? 0 : (l as number));
      },
      yToPrice: (y) => {
        const p = series.coordinateToPrice(y);
        return p === null ? null : (p as number);
      },
      candleAt: (t) => {
        if (n === 0) return null;
        const l = Math.round(timeToLogical(t));
        const c = cs[Math.min(n - 1, Math.max(0, l))];
        return c ?? null;
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, size, barSeconds]);

  const daySeparators = useMemo(() => {
    if (!coords || candles.length < 2) return [];

    const weekday = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const result: Array<{
      time: number;
      x: number;
      label: string;
    }> = [];

    let previous = zonedParts(candles[0]!.time, timezone);

    for (let i = 1; i < candles.length; i++) {
      const candle = candles[i]!;
      const current = zonedParts(candle.time, timezone);

      const changed =
        current.year !== previous.year ||
        current.month !== previous.month ||
        current.day !== previous.day;

      if (changed) {
        const x = coords.timeToX(candle.time);

        if (x !== null) {
          result.push({
            time: candle.time,
            x,
            label: `${weekday[current.weekday]} ${current.day}`,
          });
        }
      }

      previous = current;
    }

    return result;
  }, [candles, coords, timezone]);

  return (
    <ChartContext.Provider value={{ coords, version }}>
      <div
        ref={chartRootRef}
        className="relative h-full w-full overflow-hidden bg-surface"
      >
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* Day separators are derived only from currently revealed candles.
            This keeps replay causal: a future day cannot appear early. */}
        <div
          className="absolute inset-0 z-10 overflow-hidden"
          style={{ pointerEvents: "none" }}
        >
          {daySeparators.map((separator) => (
            <div
              key={separator.time}
              className="absolute top-0 bottom-0"
              style={{ left: separator.x }}
            >
              <div
                className="absolute top-2 bottom-0 border-l-2 border-solid"
                style={{ borderColor: "rgba(234, 179, 8, 0.65)" }}
              />
              <div
                className="absolute left-1 top-2 whitespace-nowrap rounded-sm bg-surface/90 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground"
              >
                {separator.label}
              </div>
            </div>
          ))}
        </div>

        {/* Overlays must sit above the chart canvases; children opt back into
            pointer events individually (drawing overlay, trade levels). */}
        <div className="absolute inset-0 z-20" style={{ pointerEvents: "none" }}>
          {children}
        </div>
      </div>
    </ChartContext.Provider>
  );
});

CandleChart.displayName = "CandleChart";

function countBefore(cs: Candle[], t: number) {
  let i = 0;
  while (i < cs.length && cs[i]!.time < t) i++;
  return i;
}
