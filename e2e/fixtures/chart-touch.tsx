import { useState } from "react";
import { createRoot } from "react-dom/client";

import { CandleChart } from "../../src/components/chart/CandleChart";
import { DrawingOverlay } from "../../src/components/chart/DrawingOverlay";
import { useChartCtx } from "../../src/components/chart/chartContext";
import { TOOLS, type Drawing } from "../../src/lib/drawings/types";
import { DEFAULT_SESSIONS } from "../../src/lib/time/ny";
import "../../src/styles.css";

const candles = Array.from({ length: 400 }, (_, i) => {
  const open = 40000 + Math.sin(i / 12) * 30 + i / 10;
  return { time: 1704204000 + i * 60, open, high: open + 8, low: open - 8, close: open + 2, volume: 1 };
});
const replayTime = candles[candles.length - 1]!.time + 60;

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
  const [crosshair, setCrosshair] = useState<number | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  return (
    <>
      <div style={{ height: 480 }} data-testid="chart">
        <CandleChart candles={candles} barSeconds={60} timezone="America/New_York" onCrosshairPrice={setCrosshair}>
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
      <output data-testid="crosshair">{JSON.stringify(crosshair)}</output>
      <output data-testid="drawings">{JSON.stringify(drawings)}</output>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
