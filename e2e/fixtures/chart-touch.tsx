import { useState } from "react";
import { createRoot } from "react-dom/client";

import { CandleChart } from "../../src/components/chart/CandleChart";
import { DrawingOverlay } from "../../src/components/chart/DrawingOverlay";
import { useChartCtx } from "../../src/components/chart/chartContext";
import { TOOLS, type Drawing } from "../../src/lib/drawings/types";
import { DEFAULT_SESSIONS } from "../../src/lib/time/ny";
import "../../src/styles.css";

const initialCandles = Array.from({ length: 400 }, (_, i) => {
  const open = 40000 + Math.sin(i / 12) * 30 + i / 10;
  return { time: 1704204000 + i * 60, open, high: open + 8, low: open - 8, close: open + 2, volume: 1 };
});

function Geometry() {
  const { coords } = useChartCtx();
  return (
    <output data-testid="geometry" hidden>
      {coords && JSON.stringify({
        from: coords.visibleFrom,
        to: coords.visibleTo,
        top: coords.yToPrice(0),
        bottom: coords.yToPrice(coords.height),
        width: coords.width,
        height: coords.height,
      })}
    </output>
  );
}

function Fixture() {
  const [candles, setCandles] = useState(initialCandles);
  const [navigation, setNavigation] = useState(0);
  const [barSeconds, setBarSeconds] = useState(60);
  const replayTime = candles[candles.length - 1]!.time + barSeconds;
  const jump = (year: number, price: number) => {
    setNavigation((value) => value + 1);
    setCandles(initialCandles.map((c, i) => ({
      ...c, time: Date.UTC(year, 1, 5, 12) / 1000 + i * 60,
      open: price, high: price + 8, low: price - 8, close: price + 2,
    })));
  };
  const [crosshair, setCrosshair] = useState<number | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  return (
    <>
      <div style={{ height: 480 }} data-testid="chart">
        <CandleChart candles={candles} barSeconds={barSeconds} viewportResetKey={String(navigation)} timezone="America/New_York" onCrosshairPrice={setCrosshair}>
          <Geometry />
          <DrawingOverlay
            drawings={drawings}
            selectedId={selectedId}
            tool={drawingMode ? TOOLS.find((t) => t.id === "fvg")! : null}
            magnet={false}
            replayTime={replayTime}
            candles={candles}
            timezone="America/New_York"
            sessions={DEFAULT_SESSIONS}
            showSessions={true}
            showTradingWindow={true}
            onCreate={(drawing) => setDrawings((ds) => [...ds, { ...drawing, id: String(ds.length) }])}
            onUpdate={(id, patch) => setDrawings((ds) => ds.map((d) => d.id === id ? { ...d, ...patch } : d))}
            onSelect={setSelectedId}
            onToolConsumed={() => setDrawingMode(false)}
          />
        </CandleChart>
      </div>
      <button type="button" onClick={() => setDrawingMode(true)}>Draw FVG</button>
      <button type="button" onClick={() => jump(2020, 29274)}>Jump to 2020</button>
      <button type="button" onClick={() => jump(2026, 51805)}>Jump to 2026</button>
      <button type="button" onClick={() => setNavigation((value) => value + 1)}>Switch session</button>
      <button type="button" onClick={() => setBarSeconds(300)}>Switch timeframe</button>
      <button type="button" onClick={() => setCandles((cs) => [...cs, { ...cs[cs.length - 1]!, time: cs[cs.length - 1]!.time + 60 }])}>Next candle</button>
      <button type="button" onClick={() => setCandles((cs) => [{ ...cs[0]!, time: cs[0]!.time - 60 }, ...cs])}>Load older history</button>
      <output data-testid="crosshair">{JSON.stringify(crosshair)}</output>
      <output data-testid="drawings">{JSON.stringify(drawings)}</output>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
