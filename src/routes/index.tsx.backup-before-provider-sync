import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CandleChart } from "@/components/chart/CandleChart";
import { DrawingOverlay } from "@/components/chart/DrawingOverlay";
import { AppShell } from "@/components/layout/AppShell";
import { AnalysisPanel, TradePanel, WorkflowPanel } from "@/components/workspace/panels";
import {
  JumpToSheet,
  NewSessionSheet,
  NoTradeSheet,
  RecordResultSheet,
  SessionsSheet,
} from "@/components/workspace/sheets";
import { ToolStrip } from "@/components/workspace/ToolStrip";
import { TradeLevels } from "@/components/workspace/TradeLevels";
import type { TradePlan } from "@/lib/backtest/types";
import { getTool } from "@/lib/drawings/types";
import { TF_SECONDS, TIMEFRAMES, type Timeframe } from "@/lib/market/types";
import { SPEEDS } from "@/lib/replay/engine";
import { useAdvance, useReplay } from "@/lib/replay/useReplay";
import { useStoresHydrated } from "@/lib/store/hydrate";
import { useJournalStore } from "@/lib/store/journalStore";
import { uid, useActiveSession, useSessionStore } from "@/lib/store/sessionStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useUIStore } from "@/lib/store/uiStore";
import { fmtDate, fmtTime, sessionAt, SESSION_LABEL } from "@/lib/time/ny";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ICT Trade Terminal — US30 replay workstation" },
      {
        name: "description",
        content:
          "Replay US30 history candle by candle, mark liquidity and structure by hand, plan trades and journal every decision.",
      },
      { property: "og:title", content: "ICT Trade Terminal — US30 replay workstation" },
      {
        property: "og:description",
        content: "A manual US30 historical replay and backtesting lab built for Android.",
      },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const ready = useStoresHydrated();
  const session = useActiveSession();
  const store = useSessionStore();
  const settings = useSettingsStore((s) => s.settings);
  const addRecord = useJournalStore((s) => s.add);
  const ui = useUIStore();
  const tz = settings.sessionTimezone;

  const viewTf: Timeframe = ui.viewTimeframe ?? session?.timeframe ?? settings.defaultTimeframe;
  const { candles, loading, lastCandle } = useReplay(session, viewTf, settings.lookbackCandles);
  const advance = useAdvance(session, viewTf, (t) => store.patchActive({ currentTime: t }));

  const [panelOpen, setPanelOpen] = useState(false);

  /* playback loop — the replay clock is the only source of truth */
  useEffect(() => {
    if (!ui.playing || !session) return;
    const speed = session.speed || 1;
    const id = window.setInterval(() => void advance(1), Math.max(60, 1000 / speed));
    return () => window.clearInterval(id);
  }, [ui.playing, session?.id, session?.speed, advance, session]);

  useEffect(() => {
    if (session && !ui.viewTimeframe) ui.setViewTimeframe(session.timeframe);
  }, [session?.id]);

  const tool = ui.activeTool ? (getTool(ui.activeTool) ?? null) : null;

  const onCreateDrawing = useCallback(
    (d: Parameters<typeof store.addDrawing>[0] extends infer _ ? never : never) => d,
    [],
  );

  const sessionsList = useMemo(
    () => Object.values(store.sessions).sort((a, b) => b.updatedAt - a.updatedAt),
    [store.sessions],
  );

  if (!ready) return <AppShell chrome={false}><div /></AppShell>;

  if (!session) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">ICT Trade Terminal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A US30 historical laboratory. You mark everything, the terminal only replays price
              and measures what you decided.
            </p>
          </div>
          <button
            type="button"
            className="touch-btn w-full max-w-xs font-semibold"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            onClick={() => ui.setSheet("newSession")}
          >
            Start a replay session
          </button>
          {sessionsList.length > 0 && (
            <button type="button" className="touch-btn w-full max-w-xs border border-border text-sm" onClick={() => ui.setSheet("sessions")}>
              Continue a saved session ({sessionsList.length})
            </button>
          )}
        </div>
        <Sheets />
      </AppShell>
    );
  }

  const nySession = SESSION_LABEL[sessionAt(session.currentTime, settings.sessions, tz)];

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden">
        {/* top bar */}
        <header className="shrink-0 border-b border-border bg-surface px-2 py-1.5">
          <div className="flex items-center gap-2">
            <button type="button" className="chip shrink-0" onClick={() => ui.setSheet("sessions")}>
              ☰
            </button>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => ui.setSheet("jumpTo")}>
              <div className="num text-sm font-semibold">
                {fmtTime(session.currentTime, tz)}{" "}
                <span className="text-xs font-normal text-muted-foreground">{fmtDate(session.currentTime, tz)}</span>
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {session.symbol} · {nySession} · {loading ? "loading…" : `${candles.length} candles`}
              </div>
            </button>
            {lastCandle && (
              <span
                className="num shrink-0 text-sm font-semibold"
                style={{ color: lastCandle.close >= lastCandle.open ? "var(--bull)" : "var(--bear)" }}
              >
                {lastCandle.close.toFixed(1)}
              </span>
            )}
          </div>
          <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                className="chip num shrink-0"
                data-active={viewTf === tf}
                onClick={() => ui.setViewTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        </header>

        {/* chart */}
        <div className="relative min-h-0 flex-1">
          <CandleChart
            candles={candles}
            barSeconds={TF_SECONDS[viewTf]}
            timezone={tz}
            onClickEmpty={() => ui.setSelectedDrawing(null)}
            onCrosshairPrice={ui.setCrosshairPrice}
          >
            <DrawingOverlay
              drawings={session.drawings}
              selectedId={ui.selectedDrawingId}
              tool={tool}
              magnet={settings.magnetToOHLC}
              replayTime={session.currentTime}
              candles={candles}
              timezone={tz}
              sessions={settings.sessions}
              showSessions={settings.showSessions}
              showTradingWindow={settings.showTradingWindow}
              onCreate={(d) => store.addDrawing({ ...d, id: uid() })}
              onUpdate={(id, patch, commit) => store.updateDrawing(id, patch, commit)}
              onSelect={ui.setSelectedDrawing}
              onToolConsumed={() => {
                if (!settings.keepToolActive) ui.setActiveTool(null);
              }}
            />
            <TradeLevels
              trade={session.trade}
              onChange={(patch) => session.trade && store.setTrade({ ...session.trade, ...patch })}
            />
          </CandleChart>
        </div>

        {/* replay controls */}
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-surface px-2 py-2">
          <button
            type="button"
            className="touch-btn flex-1 font-semibold"
            style={{
              backgroundColor: ui.playing ? "var(--surface-3)" : "var(--primary)",
              color: ui.playing ? "var(--foreground)" : "var(--primary-foreground)",
            }}
            onClick={() => ui.setPlaying(!ui.playing)}
          >
            {ui.playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="touch-btn border border-border px-4" onClick={() => void advance(1)}>
            +1
          </button>
          <button type="button" className="touch-btn border border-border px-4" onClick={() => void advance(10)}>
            +10
          </button>
          <select
            className="panel-input num w-20"
            value={session.speed}
            onChange={(e) => store.patchActive({ speed: Number(e.target.value) })}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>

        <ToolStrip
          activeTool={ui.activeTool}
          onPick={ui.setActiveTool}
          onUndo={store.undo}
          onRedo={store.redo}
          hasSelection={!!ui.selectedDrawingId}
          onDeleteSelected={() => {
            if (ui.selectedDrawingId) {
              store.removeDrawing(ui.selectedDrawingId);
              ui.setSelectedDrawing(null);
            }
          }}
        />

        {/* analysis / trade panel */}
        <div className="shrink-0 border-t border-border bg-surface">
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {(["workflow", "analysis", "trade"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className="chip capitalize"
                data-active={panelOpen && ui.panelTab === t}
                onClick={() => {
                  ui.setPanelTab(t);
                  setPanelOpen(!(panelOpen && ui.panelTab === t));
                }}
              >
                {t}
              </button>
            ))}
            <span className="flex-1" />
            {panelOpen && (
              <button type="button" className="chip" onClick={() => setPanelOpen(false)}>
                Hide
              </button>
            )}
          </div>
          {panelOpen && (
            <div className="max-h-[45dvh] overflow-y-auto border-t border-border">
              {ui.panelTab === "workflow" && <WorkflowPanel session={session} onToggle={store.toggleWorkflowStep} />}
              {ui.panelTab === "analysis" && <AnalysisPanel analysis={session.analysis} onChange={store.setAnalysis} />}
              {ui.panelTab === "trade" && (
                <TradePanel
                  trade={session.trade}
                  lastPrice={lastCandle?.close ?? null}
                  onCreate={(direction) => {
                    const p = lastCandle?.close ?? 0;
                    const risk = Math.max(10, p * 0.001);
                    const plan: TradePlan = {
                      id: uid(),
                      direction,
                      entry: Math.round(p * 10) / 10,
                      stopLoss: Math.round((direction === "long" ? p - risk : p + risk) * 10) / 10,
                      takeProfit: Math.round((direction === "long" ? p + risk * 2 : p - risk * 2) * 10) / 10,
                      status: "planned",
                      plannedAt: session.currentTime,
                    };
                    store.setTrade(plan);
                  }}
                  onPatch={(patch) => session.trade && store.setTrade({ ...session.trade, ...patch })}
                  onRemove={() => store.setTrade(null)}
                  onRecord={() => ui.setSheet("recordResult")}
                  onNoTrade={() => ui.setSheet("noTrade")}
                />
              )}
            </div>
          )}
        </div>
      </div>
      <Sheets />
    </AppShell>
  );

  function Sheets() {
    return (
      <>
        <NewSessionSheet
          open={ui.sheet === "newSession"}
          tz={tz}
          defaultTimeframe={settings.defaultTimeframe}
          defaultSpeed={settings.defaultSpeed}
          onClose={() => ui.setSheet(null)}
          onCreate={({ name, timeframe, startTime, speed }) => {
            store.createSession({ name, symbol: "US30", timeframe, startTime, speed });
            ui.setViewTimeframe(timeframe);
            ui.setSheet(null);
          }}
        />
        <SessionsSheet
          open={ui.sheet === "sessions"}
          sessions={sessionsList}
          activeId={store.activeSessionId}
          tz={tz}
          onClose={() => ui.setSheet(null)}
          onSelect={(id) => {
            store.setActive(id);
            const s = store.sessions[id];
            if (s) ui.setViewTimeframe(s.timeframe);
            ui.setSheet(null);
          }}
          onDelete={(id) => store.deleteSession(id)}
          onNew={() => ui.setSheet("newSession")}
        />
        {session && (
          <>
            <JumpToSheet
              open={ui.sheet === "jumpTo"}
              current={session.currentTime}
              tz={tz}
              onClose={() => ui.setSheet(null)}
              onJump={(t) => {
                ui.setPlaying(false);
                store.patchActive({ currentTime: t });
                ui.setSheet(null);
              }}
              onReset={() => {
                ui.setPlaying(false);
                store.patchActive({ currentTime: session.startTime });
                ui.setSheet(null);
              }}
            />
            <RecordResultSheet
              open={ui.sheet === "recordResult"}
              session={session}
              sessions={settings.sessions}
              tz={tz}
              onClose={() => ui.setSheet(null)}
              onSave={(record) => {
                addRecord(record);
                store.setTrade(record.trade);
                ui.setSheet(null);
              }}
            />
            <NoTradeSheet
              open={ui.sheet === "noTrade"}
              session={session}
              sessions={settings.sessions}
              tz={tz}
              onClose={() => ui.setSheet(null)}
              onSave={(record) => {
                addRecord(record);
                ui.setSheet(null);
              }}
            />
          </>
        )}
      </>
    );
  }
}
