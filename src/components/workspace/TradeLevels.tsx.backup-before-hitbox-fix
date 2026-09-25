import { useCallback, useEffect, useRef, useState } from "react";

import { useChartCtx } from "@/components/chart/chartContext";
import { rrRatio, type TradePlan } from "@/lib/backtest/types";

interface Props {
  trade: TradePlan | null;
  onChange: (patch: Partial<TradePlan>) => void;
}

type Level = "entry" | "stopLoss" | "takeProfit";

const LABEL: Record<Level, string> = { entry: "ENTRY", stopLoss: "SL", takeProfit: "TP" };

/** Draggable entry / SL / TP lines. The app never decides levels — the trader does. */
export function TradeLevels({ trade, onChange }: Props) {
  const { coords } = useChartCtx();
  const [dragging, setDragging] = useState<Level | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const cRef = useRef(coords);
  cRef.current = coords;
  const dRef = useRef(dragging);
  dRef.current = dragging;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const move = useCallback((clientY: number) => {
    const c = cRef.current;
    const lvl = dRef.current;
    if (!c || !lvl) return;
    const rect = ref.current?.getBoundingClientRect();
    const y = clientY - (rect?.top ?? 0);
    const p = c.yToPrice(y);
    if (p === null) return;
    onChangeRef.current({ [lvl]: Math.round(p * 10) / 10 } as Partial<TradePlan>);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      move(e.clientY);
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, move]);

  if (!coords || !trade) return null;
  const { width, height } = coords;
  const colors: Record<Level, string> = {
    entry: "var(--primary)",
    stopLoss: "var(--bear)",
    takeProfit: "var(--bull)",
  };
  const yEntry = coords.priceToY(trade.entry);
  const ySl = coords.priceToY(trade.stopLoss);
  const yTp = coords.priceToY(trade.takeProfit);
  const closed = trade.status === "closed";

  const band = (a: number | null, b: number | null, color: string) =>
    a === null || b === null ? null : (
      <rect x={0} y={Math.min(a, b)} width={width} height={Math.abs(b - a)} fill={color} fillOpacity={0.07} />
    );

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className="absolute left-0 top-0 select-none"
      style={{ pointerEvents: "none", touchAction: dragging ? "none" : "auto" }}
    >
      {band(yEntry, ySl, "var(--bear)")}
      {band(yEntry, yTp, "var(--bull)")}
      {(["takeProfit", "entry", "stopLoss"] as Level[]).map((lvl) => {
        const y = coords.priceToY(trade[lvl]);
        if (y === null) return null;
        const color = colors[lvl];
        const text = `${LABEL[lvl]} ${trade[lvl].toFixed(1)}`;
        return (
          <g key={lvl}>
            <line
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              stroke={color}
              strokeWidth={lvl === "entry" ? 2 : 1.5}
              strokeDasharray={lvl === "entry" ? undefined : "5 4"}
            />
            <g
              style={{ pointerEvents: closed ? "none" : "all", cursor: "ns-resize" }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(lvl);
              }}
            >
              <rect x={6} y={y - 11} width={text.length * 7 + 14} height={22} rx={4} fill={color} fillOpacity={0.92} />
              <text
                x={13}
                y={y + 4}
                fontSize={11}
                fontWeight={700}
                fontFamily="IBM Plex Mono, monospace"
                fill="var(--background)"
              >
                {text}
              </text>
              <rect x={0} y={y - 22} width={width} height={44} fill="transparent" />
            </g>
          </g>
        );
      })}
      {yEntry !== null && (
        <text x={width - 8} y={yEntry - 8} textAnchor="end" fontSize={11} fontFamily="IBM Plex Mono, monospace" fill="var(--muted-foreground)">
          {`R:R ${rrRatio(trade).toFixed(2)}`}
        </text>
      )}
    </svg>
  );
}
