import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";

import { useChartCtx, type CoordApi } from "./chartContext";
import { isTwoPoint, type Drawing, type PricePoint, type ToolDef } from "@/lib/drawings/types";
import type { Candle } from "@/lib/market/types";
import { sessionAt, type SessionName, type SessionWindows, inWindow, minutesOfDay } from "@/lib/time/ny";

interface Props {
  drawings: Drawing[];
  selectedId: string | null;
  tool: ToolDef | null;
  magnet: boolean;
  replayTime: number;
  candles: Candle[];
  timezone: string;
  sessions: SessionWindows;
  showSessions: boolean;
  showTradingWindow: boolean;
  onCreate: (d: Omit<Drawing, "id">) => void;
  onUpdate: (id: string, patch: Partial<Drawing>, commit: boolean) => void;
  onSelect: (id: string | null) => void;
  onToolConsumed: () => void;
}

type Drag =
  | { type: "create"; p1: PricePoint; p2: PricePoint; startX: number; startY: number }
  | { type: "move"; id: string; startX: number; startY: number; startPoints: PricePoint[]; moved: boolean }
  | { type: "point"; id: string; index: number; startPoints: PricePoint[] };

const SNAP_PX = 14;
const sessionCache = new Map<string, SessionName>();

export function DrawingOverlay(props: Props) {
  const { coords } = useChartCtx();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const propsRef = useRef(props);
  propsRef.current = props;
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  const localXY = useCallback((e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);

  const toPoint = useCallback((x: number, y: number, c: CoordApi, snap: boolean): PricePoint => {
    let time = c.xToTime(x);
    let price = c.yToPrice(y) ?? 0;
    // never allow anchoring in the future
    const maxT = propsRef.current.replayTime;
    if (time > maxT) time = maxT;
    if (snap) {
      const cd = c.candleAt(time);
      if (cd) {
        time = cd.time;
        let best = price;
        let bestD = SNAP_PX;
        for (const v of [cd.open, cd.high, cd.low, cd.close]) {
          const yy = c.priceToY(v);
          if (yy !== null && Math.abs(yy - y) < bestD) {
            bestD = Math.abs(yy - y);
            best = v;
          }
        }
        price = best;
      }
    }
    return { time, price: Math.round(price * 10) / 10 };
  }, []);

  // global move / up
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const c = coordsRef.current;
      const d = dragRef.current;
      if (!c || !d) return;
      const { x, y } = localXY(e);
      const p = propsRef.current;
      if (d.type === "create") {
        setDrag({ ...d, p2: toPoint(x, y, c, p.magnet) });
      } else if (d.type === "move") {
        const dx = x - d.startX;
        const dy = y - d.startY;
        if (!d.moved && Math.hypot(dx, dy) < 3) return;
        const pts = d.startPoints.map((pt) => {
          const px = c.timeToX(pt.time) ?? 0;
          const py = c.priceToY(pt.price) ?? 0;
          const t = Math.min(p.replayTime, c.xToTime(px + dx));
          return { time: t, price: Math.round((c.yToPrice(py + dy) ?? pt.price) * 10) / 10 };
        });
        p.onUpdate(d.id, { points: pts }, false);
        if (!d.moved) setDrag({ ...d, moved: true });
      } else if (d.type === "point") {
        const pts = d.startPoints.slice();
        pts[d.index] = toPoint(x, y, c, p.magnet);
        p.onUpdate(d.id, { points: pts }, false);
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      const p = propsRef.current;
      const c = coordsRef.current;
      if (d && c) {
        if (d.type === "create" && p.tool) {
          const dist = Math.hypot(
            (c.timeToX(d.p2.time) ?? 0) - (c.timeToX(d.p1.time) ?? 0),
            (c.priceToY(d.p2.price) ?? 0) - (c.priceToY(d.p1.price) ?? 0),
          );
          if (dist > 6) {
            p.onCreate({
              kind: p.tool.kind,
              toolId: p.tool.id,
              points: [d.p1, d.p2],
              color: p.tool.color,
              label: p.tool.defaultLabel,
              extendRight: p.tool.extendRight,
              createdAtReplayTime: p.replayTime,
            });
            p.onToolConsumed();
          }
        } else if (d.type === "move" || d.type === "point") {
          const cur = p.drawings.find((x) => x.id === d.id);
          if (cur) p.onUpdate(d.id, { points: cur.points }, true);
        }
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, localXY, toPoint]);

  const onRootDown = (e: RPointerEvent<SVGSVGElement>) => {
    const { tool, magnet, replayTime } = props;
    if (!tool || !coords) return;
    e.preventDefault();
    const { x, y } = localXY(e);
    const p1 = toPoint(x, y, coords, magnet);
    if (isTwoPoint(tool.kind)) {
      setDrag({ type: "create", p1, p2: p1, startX: x, startY: y });
    } else {
      props.onCreate({
        kind: tool.kind,
        toolId: tool.id,
        points: [p1],
        color: tool.color,
        label: tool.defaultLabel,
        extendRight: tool.extendRight,
        createdAtReplayTime: replayTime,
      });
      props.onToolConsumed();
    }
  };

  const beginMove = (e: RPointerEvent, d: Drawing) => {
    if (props.tool) return;
    e.stopPropagation();
    e.preventDefault();
    const { x, y } = localXY(e);
    props.onSelect(d.id);
    // snapshot for undo
    props.onUpdate(d.id, { points: d.points }, true);
    setDrag({ type: "move", id: d.id, startX: x, startY: y, startPoints: d.points, moved: false });
  };
  const beginPoint = (e: RPointerEvent, d: Drawing, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    props.onUpdate(d.id, { points: d.points }, true);
    setDrag({ type: "point", id: d.id, index, startPoints: d.points });
  };

  if (!coords) return null;
  const { width, height } = coords;
  const toolActive = !!props.tool;

  const draft: Drawing | null =
    drag?.type === "create" && props.tool
      ? {
          id: "__draft",
          kind: props.tool.kind,
          toolId: props.tool.id,
          points: [drag.p1, drag.p2],
          color: props.tool.color,
          label: props.tool.defaultLabel,
          extendRight: props.tool.extendRight,
          createdAtReplayTime: props.replayTime,
        }
      : null;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="absolute left-0 top-0 select-none"
      style={{
        pointerEvents: toolActive ? "all" : "none",
        touchAction: toolActive || drag ? "none" : "auto",
        cursor: toolActive ? "crosshair" : "default",
      }}
      onPointerDown={onRootDown}
    >
      {(props.showSessions || props.showTradingWindow) && (
        <SessionBands
          coords={coords}
          candles={props.candles}
          timezone={props.timezone}
          sessions={props.sessions}
          showSessions={props.showSessions}
          showTradingWindow={props.showTradingWindow}
        />
      )}
      {props.drawings.map((d) => (
        <Shape
          key={d.id}
          d={d}
          coords={coords}
          selected={d.id === props.selectedId}
          interactive={!toolActive}
          onDown={(e) => beginMove(e, d)}
          onPointDown={(e, i) => beginPoint(e, d, i)}
        />
      ))}
      {draft && <Shape d={draft} coords={coords} selected={false} interactive={false} />}
    </svg>
  );
}

/* ---------- shapes ---------- */

function Shape({
  d,
  coords,
  selected,
  interactive,
  onDown,
  onPointDown,
}: {
  d: Drawing;
  coords: CoordApi;
  selected: boolean;
  interactive: boolean;
  onDown?: (e: RPointerEvent) => void;
  onPointDown?: (e: RPointerEvent, index: number) => void;
}) {
  const { width } = coords;
  const pts = d.points.map((p) => ({ x: coords.timeToX(p.time), y: coords.priceToY(p.price) }));
  const p0 = pts[0];
  if (!p0 || p0.x === null || p0.y === null) return null;
  const pe = interactive ? ("all" as const) : ("none" as const);
  const stroke = selected ? 2.5 : 1.5;
  const color = d.color;
  const handles = selected && interactive && (
    <>
      {pts.map((p, i) =>
        p.x === null || p.y === null ? null : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={11}
            fill="var(--background)"
            stroke={color}
            strokeWidth={2}
            style={{ pointerEvents: "all", cursor: "grab" }}
            onPointerDown={(e) => onPointDown?.(e, i)}
          />
        ),
      )}
    </>
  );

  switch (d.kind) {
    case "hline": {
      const y = p0.y;
      return (
        <g>
          <line x1={0} x2={width} y1={y} y2={y} stroke={color} strokeWidth={stroke} strokeDasharray="4 3" />
          <line x1={0} x2={width} y1={y} y2={y} stroke="transparent" strokeWidth={22} style={{ pointerEvents: pe }} onPointerDown={onDown} />
          <Tag x={6} y={y - 6} text={`${d.label ? d.label + " " : ""}${d.points[0]!.price.toFixed(1)}`} color={color} />
          {handles}
        </g>
      );
    }
    case "ray": {
      const y = p0.y;
      const x1 = Math.max(0, p0.x);
      return (
        <g>
          <line x1={x1} x2={width} y1={y} y2={y} stroke={color} strokeWidth={stroke} />
          <line x1={x1} x2={width} y1={y} y2={y} stroke="transparent" strokeWidth={22} style={{ pointerEvents: pe }} onPointerDown={onDown} />
          <Tag x={x1 + 4} y={y - 6} text={`${d.label ?? ""} ${d.points[0]!.price.toFixed(1)}`} color={color} />
          {handles}
        </g>
      );
    }
    case "line":
    case "arrow": {
      const p1 = pts[1];
      if (!p1 || p1.x === null || p1.y === null) return null;
      const dash = d.toolId === "mss" ? "6 4" : undefined;
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      return (
        <g>
          <defs>
            <marker id={`arrow-${d.id}`} markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={color} />
            </marker>
          </defs>
          <line
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={dash}
            markerEnd={d.kind === "arrow" ? `url(#arrow-${d.id})` : undefined}
          />
          <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="transparent" strokeWidth={24} style={{ pointerEvents: pe }} onPointerDown={onDown} />
          {d.label && <Tag x={mx + 4} y={my - 6} text={d.label} color={color} />}
          {handles}
        </g>
      );
    }
    case "rect": {
      const p1 = pts[1];
      if (!p1 || p1.x === null || p1.y === null) return null;
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      const w = d.extendRight ? Math.max(0, width - x) : Math.abs(p1.x - p0.x);
      const h = Math.abs(p1.y - p0.y);
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.16} stroke={color} strokeWidth={selected ? 2 : 1} style={{ pointerEvents: pe }} onPointerDown={onDown} />
          {d.label && <Tag x={x + 4} y={y + 14} text={d.label} color={color} />}
          {handles}
        </g>
      );
    }
    case "text": {
      return (
        <g style={{ pointerEvents: pe }} onPointerDown={onDown}>
          <Tag x={p0.x} y={p0.y} text={d.label ?? "Note"} color={color} boxed selected={selected} />
          {handles}
        </g>
      );
    }
    case "marker": {
      const up = d.toolId === "sweep" ? d.points[0]!.price >= (coords.candleAt(d.points[0]!.time)?.close ?? 0) : ["hh", "lh"].includes(d.toolId);
      const yOff = up ? -10 : 10;
      const tri = up
        ? `M${p0.x - 5},${p0.y - 4} L${p0.x + 5},${p0.y - 4} L${p0.x},${p0.y + 2} z`
        : `M${p0.x - 5},${p0.y + 4} L${p0.x + 5},${p0.y + 4} L${p0.x},${p0.y - 2} z`;
      return (
        <g style={{ pointerEvents: pe }} onPointerDown={onDown}>
          <path d={tri} fill={color} />
          <Tag x={p0.x} y={p0.y + yOff + (up ? -2 : 12)} text={d.label ?? ""} color={color} centered selected={selected} />
          <circle cx={p0.x} cy={p0.y} r={14} fill="transparent" />
          {handles}
        </g>
      );
    }
  }
}

function Tag({
  x,
  y,
  text,
  color,
  centered,
  boxed,
  selected,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  centered?: boolean;
  boxed?: boolean;
  selected?: boolean;
}) {
  const w = text.length * 6.6 + 10;
  const bx = centered ? x - w / 2 : x;
  return (
    <g>
      {(boxed || selected) && (
        <rect x={bx - 2} y={y - 11} width={w} height={16} rx={3} fill="var(--surface)" fillOpacity={0.9} stroke={selected ? color : "none"} />
      )}
      <text
        x={bx + 3}
        y={y + 1}
        fill={color}
        fontSize={11}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight={600}
        style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: boxed ? 0 : 3 }}
      >
        {text}
      </text>
    </g>
  );
}

/* ---------- session shading ---------- */

function SessionBands({
  coords,
  candles,
  timezone,
  sessions,
  showSessions,
  showTradingWindow,
}: {
  coords: CoordApi;
  candles: Candle[];
  timezone: string;
  sessions: SessionWindows;
  showSessions: boolean;
  showTradingWindow: boolean;
}) {
  const { visibleFrom, visibleTo, height, barSeconds } = coords;
  const segs: { x1: number; x2: number; s: SessionName; tw: boolean }[] = [];
  let cur: { x1: number; x2: number; s: SessionName; tw: boolean } | null = null;
  const halfBar = ((coords.timeToX(visibleFrom + barSeconds) ?? 0) - (coords.timeToX(visibleFrom) ?? 0)) / 2;
  for (const c of candles) {
    if (c.time + barSeconds < visibleFrom || c.time > visibleTo) continue;
    const key = `${timezone}|${c.time}|${sessions.asia}|${sessions.london}|${sessions.newyork}`;
    let s = sessionCache.get(key);
    if (!s) {
      s = sessionAt(c.time, sessions, timezone);
      if (sessionCache.size > 20000) sessionCache.clear();
      sessionCache.set(key, s);
    }
    const tw = inWindow(minutesOfDay(c.time, timezone), sessions.tradingWindow);
    const x = coords.timeToX(c.time);
    if (x === null) continue;
    const x1 = x - halfBar;
    const x2 = x + halfBar;
    if (cur && cur.s === s && cur.tw === tw && x1 - cur.x2 < halfBar * 4) {
      cur.x2 = x2;
    } else {
      if (cur) segs.push(cur);
      cur = { x1, x2, s, tw };
    }
  }
  if (cur) segs.push(cur);
  const fill: Record<SessionName, string> = {
    asia: "var(--info)",
    london: "var(--poi)",
    newyork: "var(--warn)",
    off: "transparent",
  };
  return (
    <g style={{ pointerEvents: "none" }}>
      {segs.map((s, i) => (
        <g key={i}>
          {showSessions && s.s !== "off" && (
            <rect x={s.x1} y={0} width={Math.max(0, s.x2 - s.x1)} height={height} fill={fill[s.s]} fillOpacity={0.045} />
          )}
          {showTradingWindow && s.tw && (
            <rect x={s.x1} y={0} width={Math.max(0, s.x2 - s.x1)} height={3} fill="var(--warn)" fillOpacity={0.9} />
          )}
        </g>
      ))}
    </g>
  );
}
