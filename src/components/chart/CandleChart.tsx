import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  TrackingModeExitMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { toPng } from "html-to-image";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import { ChartContext, type CoordApi } from "./chartContext";
import type { Candle } from "@/lib/market/types";
import { fmtDate, fmtTime, tzOffsetSeconds } from "@/lib/time/ny";

interface Props {
  candles: Candle[];
  barSeconds: number;
  timezone: string;
  symbol?: string;
  timeframe?: string;
  onClickEmpty?: () => void;
  onVisibleRangeChange?: (fromLogical: number) => void;
  onCrosshairPrice?: (price: number | null) => void;
  reserveVerticalSpace?: boolean;
  children?: ReactNode;
}

export interface CandleChartHandle {
  captureSnapshot: () => Promise<Blob>;
}

/* ------------------------------------------------------------------ *
 * Tuning knobs
 * ------------------------------------------------------------------ */
const PRICE_DECIMALS = 1;
/** true = one-finger vertical drag pans price (TradingView). false = MT5-style, price only via axis. */
const TOUCH_PRICE_PAN = false;
const MIN_BAR_SPACING = 0.5;
const MAX_BAR_SPACING = 40;
/** frames the geometry loop keeps polling after the last change before it sleeps */
const IDLE_FRAMES = 10;
const WEEKDAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * lightweight-charts only understands hex / rgb(a) / hsl(a) / named colours.
 * Our design tokens are `oklch(...)`, so every value is rasterised to rgba().
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
    if (paintCtx.fillStyle === "#000" && value !== "#000") return fallback;
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

/* ------------------------------------------------------------------ *
 * Cheap timezone maths (no Intl in hot paths)
 * UTC offsets only change on hour boundaries, so cache one per UTC hour.
 * ------------------------------------------------------------------ */
const offsetCache = new Map<string, Map<number, number>>();
function offsetFor(t: number, tz: string): number {
  let m = offsetCache.get(tz);
  if (!m) {
    m = new Map();
    offsetCache.set(tz, m);
  }
  const bucket = Math.floor(t / 3600);
  let v = m.get(bucket);
  if (v === undefined) {
    v = tzOffsetSeconds(bucket * 3600, tz);
    m.set(bucket, v);
  }
  return v;
}
/** local calendar day number (days since 1970-01-01 in the given timezone) */
function dayNo(t: number, tz: string): number {
  return Math.floor((t + offsetFor(t, tz)) / 86400);
}

function lowerBound(cs: Candle[], t: number): number {
  let lo = 0;
  let hi = cs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cs[mid]!.time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const CandleChart = forwardRef<CandleChartHandle, Props>(function CandleChart(
  {
    candles,
    barSeconds,
    timezone,
    onClickEmpty,
    onVisibleRangeChange,
    onCrosshairPrice,
    reserveVerticalSpace = false,
    children,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRootRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const prevRef = useRef<Candle[]>([]);
  const prevBarSecondsRef = useRef(barSeconds);
  const candlesRef = useRef<Candle[]>(candles);
  candlesRef.current = candles;
  const pumpRef = useRef<() => void>(() => {});
  const dirtyRef = useRef(false);
  const [version, setVersion] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [showLatest, setShowLatest] = useState(false);
  const [autoScaleOn, setAutoScaleOn] = useState(true);
  const cbRef = useRef({ onClickEmpty, onVisibleRangeChange, onCrosshairPrice });
  cbRef.current = { onClickEmpty, onVisibleRangeChange, onCrosshairPrice };
  const tzRef = useRef(timezone);
  tzRef.current = timezone;

  const goLatest = useCallback(() => {
    chartRef.current?.timeScale().scrollToPosition(6, true);
  }, []);
  const enableAuto = useCallback(() => {
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    pumpRef.current();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      captureSnapshot: async () => {
        const root = chartRootRef.current;
        if (!root) throw new Error("Chart is not mounted.");

        // Wait until the chart has had a stable layout for several frames.
        // This matters on Android because closing the Trade/Analysis panel
        // can require multiple layout + chart resize passes.
        let lastSize = "";
        let stableFrames = 0;
        const deadline = performance.now() + 1500;

        while (stableFrames < 3 && performance.now() < deadline) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });

          const currentSize = `${root.clientWidth}x${root.clientHeight}`;

          if (currentSize === lastSize) {
            stableFrames += 1;
          } else {
            stableFrames = 0;
          }

          lastSize = currentSize;
        }

        const dataUrl = await toPng(root, {
          cacheBust: true,
          pixelRatio: Math.min(Math.max(window.devicePixelRatio || 1, 2), 3),
          backgroundColor: getComputedStyle(root).backgroundColor || "#070A0F",
          // floating UI buttons must not appear in journal snapshots
          filter: (node) => {
            const ds = (node as HTMLElement).dataset;
            return !(ds && ds.noSnap !== undefined);
          },
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
      // MT5-style dotted grid
      grid: {
        vertLines: { color: grid, style: LineStyle.Dotted },
        horzLines: { color: grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.04, bottom: 0.04 },
        entireTextOnly: true,
        minimumWidth: 58, // stable axis width -> overlay width never jumps
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 15,
        barSpacing: 6,
        minBarSpacing: MIN_BAR_SPACING,
        maxBarSpacing: MAX_BAR_SPACING,
        tickMarkFormatter: (t: UTCTimestamp) => {
          const d = new Date(((t as number) + offsetFor(t as number, tzRef.current)) * 1000);
          const h = d.getUTCHours();
          const m = d.getUTCMinutes();
          if (h === 0 && m === 0) return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        },
      },
      localization: {
        timeFormatter: (t: UTCTimestamp) => `${fmtDate(t, tzRef.current)} ${fmtTime(t, tzRef.current)}`,
        priceFormatter: (p: number) => p.toFixed(PRICE_DECIMALS),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: cross, width: 1, style: LineStyle.Dashed, labelBackgroundColor: surface3 },
        horzLine: { color: cross, width: 1, style: LineStyle.Dashed, labelBackgroundColor: surface3 },
      },
      // long-press shows the crosshair and keeps it until the next tap (MT5 / TradingView mobile)
      trackingMode: { exitMode: TrackingModeExitMode.OnNextTap },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: TOUCH_PRICE_PAN,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
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
      priceLineStyle: LineStyle.Dotted,
      lastValueVisible: true,
      priceFormat: { type: "price", precision: PRICE_DECIMALS, minMove: 1 / 10 ** PRICE_DECIMALS },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    /*
     * Geometry loop. Replaces the old 250 ms setInterval.
     * Runs only while something is changing (pan, zoom, kinetic scroll, axis drag,
     * data tick), compares a few numbers per frame, and re-renders the overlays
     * (synchronously, same frame as the canvas) only when they actually changed.
     */
    let raf = 0;
    let idle = 0;
    let disposed = false;
    const sig = new Float64Array(6).fill(Number.NaN);
    const next = new Float64Array(6);

    const frame = () => {
      raf = 0;
      if (disposed) return;
      const ts = chart.timeScale();
      const range = ts.getVisibleLogicalRange();
      const w = ts.width();
      const h = chart.paneSize().height;
      next[0] = range ? range.from : Number.NaN;
      next[1] = range ? range.to : Number.NaN;
      next[2] = series.coordinateToPrice(0) ?? Number.NaN;
      next[3] = series.coordinateToPrice(h) ?? Number.NaN;
      next[4] = w;
      next[5] = h;
      let changed = dirtyRef.current;
      for (let i = 0; i < 6; i++) {
        if (!Object.is(next[i], sig[i])) {
          changed = true;
          sig[i] = next[i]!;
        }
      }
      if (changed) {
        dirtyRef.current = false;
        idle = 0;
        const n = candlesRef.current.length;
        const behind = !!range && n > 0 && range.to < n - 2;
        const auto = chart.priceScale("right").options().autoScale;
        flushSync(() => {
          setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
          setShowLatest((v) => (v === behind ? v : behind));
          setAutoScaleOn((v) => (v === auto ? v : auto));
          setVersion((v) => v + 1);
        });
      } else {
        idle++;
      }
      if (idle < IDLE_FRAMES) raf = requestAnimationFrame(frame);
    };
    const pump = () => {
      idle = 0;
      if (!raf && !disposed) raf = requestAnimationFrame(frame);
    };
    pumpRef.current = pump;

    // bubble-phase listeners run after the chart's own handlers
    const evts = ["pointerdown", "pointermove", "pointerup", "touchstart", "touchmove", "touchend", "wheel", "dblclick"] as const;
    for (const e of evts) el.addEventListener(e, pump, { passive: true });

    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      pump();
      if (r) cbRef.current.onVisibleRangeChange?.(r.from);
    });
    chart.timeScale().subscribeSizeChange(pump);
    chart.subscribeClick(() => cbRef.current.onClickEmpty?.());
    chart.subscribeCrosshairMove((p: MouseEventParams<Time>) => {
      const cb = cbRef.current.onCrosshairPrice;
      if (!p.point || p.time === undefined) {
        cb?.(null);
        return;
      }
      if (cb) cb(series.coordinateToPrice(p.point.y));
    });

    const ro = new ResizeObserver(pump);
    ro.observe(el);
    pump();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      for (const e of evts) el.removeEventListener(e, pump);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      prevRef.current = [];
      pumpRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    chartRef.current?.priceScale("right").applyOptions({
      scaleMargins: reserveVerticalSpace ? { top: 0.2, bottom: 0.2 } : { top: 0.04, bottom: 0.04 },
    });
    pumpRef.current();
  }, [reserveVerticalSpace]);

  // Feed the causal candle set to the chart.
  //  - tail-only change (forming candle / one new candle) -> series.update(): O(1)
  //  - anything else -> setData(), then restore a sensible viewport
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
    const lastNow = candles[candles.length - 1];
    const prevLast = prev[prev.length - 1];

    const replayTrim =
      prev.length > 0 && first !== undefined && prevFirst !== undefined && first.time > prevFirst.time;

    // Same newest candle => older candles were prepended (history scroll).
    const historyPrepended =
      prev.length > 0 &&
      first !== undefined &&
      prevFirst !== undefined &&
      first.time < prevFirst.time &&
      lastNow !== undefined &&
      prevLast !== undefined &&
      lastNow.time === prevLast.time;

    const jumpedBack = lastNow !== undefined && prevLast !== undefined && lastNow.time < prevLast.time;

    const sameHead =
      prev.length > 0 &&
      first !== undefined &&
      prevFirst !== undefined &&
      first.time === prevFirst.time &&
      prevBarSecondsRef.current === barSeconds;
    const grew = candles.length - prev.length;
    const mid = Math.min(prev.length, candles.length) >> 1;
    const tailOnly =
      sameHead &&
      lastNow !== undefined &&
      prevLast !== undefined &&
      (grew === 0 || grew === 1) &&
      lastNow.time >= prevLast.time &&
      candles[prev.length - 1]?.time === prevLast.time &&
      candles[mid]?.time === prev[mid]?.time;

    if (tailOnly) {
      if (grew === 1) series.update(toBar(candles[prev.length - 1]!)); // re-sync the previously forming bar
      series.update(toBar(lastNow!));
    } else {
      series.setData(candles.map(toBar));

      if (prev.length === 0 || jumpedBack) {
        chart.timeScale().scrollToPosition(6, false);
      } else if (replayTrim) {
        if (!keepRange || keepRange.to >= prev.length - 1) {
          // following the live edge -> keep following
          chart.timeScale().scrollToPosition(6, false);
        } else {
          // user panned back: hold the same candles under their finger
          const trimmed = lowerBound(prev, first!.time);
          chart.timeScale().setVisibleLogicalRange({
            from: keepRange.from - trimmed,
            to: keepRange.to - trimmed,
          });
        }
      } else if (historyPrepended && keepRange) {
        const shift = lowerBound(candles, prevFirst!.time);
        if (shift > 0) {
          chart.timeScale().setVisibleLogicalRange({
            from: keepRange.from + shift,
            to: keepRange.to + shift,
          });
        }
      }
    }

    prevRef.current = candles;
    prevBarSecondsRef.current = barSeconds;
    dirtyRef.current = true;
    pumpRef.current();
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

  // Day boundaries depend only on candles + timezone (cheap, cached offsets).
  // They are anchored to market time and only use revealed candles, so replay stays causal.
  const dayMarks = useMemo(() => {
    const out: Array<{ time: number; label: string }> = [];
    if (candles.length < 2) return out;
    let prevDay = dayNo(candles[0]!.time, timezone);
    for (let i = 1; i < candles.length; i++) {
      const t = candles[i]!.time;
      const dn = dayNo(t, timezone);
      if (dn !== prevDay) {
        out.push({
          time: t,
          label: `${WEEKDAY[(dn + 4) % 7]} ${new Date(dn * 86400000).getUTCDate()}`,
        });
        prevDay = dn;
      }
    }
    return out;
  }, [candles, timezone]);

  return (
    <ChartContext.Provider value={{ coords, version }}>
      <div
        ref={chartRootRef}
        className="relative h-full w-full overflow-hidden bg-surface"
        style={{ touchAction: "none", overscrollBehavior: "none" }}
      >
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* Day separators: only the visible ones are rendered. */}
        <div className="absolute inset-0 z-10 overflow-hidden" style={{ pointerEvents: "none" }}>
          {coords &&
            dayMarks.map((m) => {
              if (m.time < coords.visibleFrom - barSeconds || m.time > coords.visibleTo + barSeconds) {
                return null;
              }
              const x = coords.timeToX(m.time);
              if (x === null || x < -1 || x > coords.width + 1) return null;
              return (
                <div key={m.time} className="absolute top-0 bottom-0" style={{ left: x }}>
                  <div
                    className="absolute top-2 bottom-0 border-l-2 border-solid"
                    style={{ borderColor: "rgba(234, 179, 8, 0.65)" }}
                  />
                  <div className="absolute left-1 top-2 whitespace-nowrap rounded-sm bg-surface/90 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground">
                    {m.label}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Overlays must sit above the chart canvases; children opt back into
            pointer events individually (drawing overlay, trade levels). */}
        <div className="absolute inset-0 z-20" style={{ pointerEvents: "none" }}>
          {children}
        </div>

        {/* HUD: helper buttons */}
        <div className="absolute inset-0 z-30" style={{ pointerEvents: "none" }}>
          {showLatest && (
            <button
              type="button"
              data-no-snap
              aria-label="Jump to latest candle"
              onClick={goLatest}
              className="absolute bottom-9 right-[68px] flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/90 text-base shadow"
              style={{ pointerEvents: "auto", color: "var(--foreground)" }}
            >
              »
            </button>
          )}
          {!autoScaleOn && (
            <button
              type="button"
              data-no-snap
              aria-label="Auto-scale price"
              onClick={enableAuto}
              className="absolute bottom-0.5 right-1 h-6 min-w-6 rounded border border-border bg-surface/90 px-1.5 text-[11px] font-semibold"
              style={{ pointerEvents: "auto", color: "var(--foreground)" }}
            >
              A
            </button>
          )}
        </div>
      </div>
    </ChartContext.Provider>
  );
});

CandleChart.displayName = "CandleChart";
