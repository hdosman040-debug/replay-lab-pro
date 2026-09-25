import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Field } from "@/components/workspace/panels";
import { SPEEDS } from "@/lib/replay/engine";
import { TIMEFRAMES, type Timeframe } from "@/lib/market/types";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useStoresHydrated } from "@/lib/store/hydrate";
import type { SessionWindows } from "@/lib/time/ny";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ICT Trade Terminal" },
      { name: "description", content: "Chart, replay, session window and data preferences for your US30 lab." },
      { property: "og:title", content: "Settings — ICT Trade Terminal" },
      { property: "og:description", content: "Chart, replay, session window and data preferences for your US30 lab." },
    ],
  }),
  component: SettingsPage,
});

const TZS = ["America/New_York", "UTC", "Europe/London", "Africa/Addis_Ababa", "Asia/Tokyo"];

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
      onClick={() => onChange(!value)}
    >
      {label}
      <span
        className="h-6 w-11 rounded-full p-0.5 transition-colors"
        style={{ backgroundColor: value ? "var(--primary)" : "var(--surface-3)" }}
      >
        <span
          className="block h-5 w-5 rounded-full bg-background transition-transform"
          style={{ transform: value ? "translateX(20px)" : "none" }}
        />
      </span>
    </button>
  );
}

function WindowRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [string, string];
  onChange: (v: [string, string]) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <input className="panel-input num w-24" type="time" value={value[0]} onChange={(e) => onChange([e.target.value, value[1]])} />
      <input className="panel-input num w-24" type="time" value={value[1]} onChange={(e) => onChange([value[0], e.target.value])} />
    </div>
  );
}

function SettingsPage() {
  const ready = useStoresHydrated();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const setWindow = (k: keyof SessionWindows, v: [string, string]) =>
    update({ sessions: { ...settings.sessions, [k]: v } });

  if (!ready) return <AppShell><div /></AppShell>;

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <PageHeader title="Settings" subtitle="Nothing here is hard-coded" />
        <div className="space-y-5 p-3">
          <section className="space-y-2">
            <h2 className="eyebrow">Replay defaults</h2>
            <Field label="Default timeframe">
              <div className="flex flex-wrap gap-1.5">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    className="chip"
                    data-active={settings.defaultTimeframe === tf}
                    onClick={() => update({ defaultTimeframe: tf as Timeframe })}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Default speed (candles / second)">
              <div className="flex flex-wrap gap-1.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip num"
                    data-active={settings.defaultSpeed === s}
                    onClick={() => update({ defaultSpeed: s })}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Lookback candles: ${settings.lookbackCandles}`}>
              <input
                type="range"
                min={100}
                max={800}
                step={50}
                className="w-full"
                value={settings.lookbackCandles}
                onChange={(e) => update({ lookbackCandles: Number(e.target.value) })}
              />
            </Field>
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">Session timezone & windows</h2>
            <Field label="Timezone (never your device clock)">
              <select
                className="panel-input"
                value={settings.sessionTimezone}
                onChange={(e) => update({ sessionTimezone: e.target.value })}
              >
                {TZS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <WindowRow label="Asia" value={settings.sessions.asia} onChange={(v) => setWindow("asia", v)} />
            <WindowRow label="London" value={settings.sessions.london} onChange={(v) => setWindow("london", v)} />
            <WindowRow label="New York" value={settings.sessions.newyork} onChange={(v) => setWindow("newyork", v)} />
            <WindowRow
              label="Trading window"
              value={settings.sessions.tradingWindow}
              onChange={(v) => setWindow("tradingWindow", v)}
            />
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">Chart</h2>
            <Toggle label="Shade sessions" value={settings.showSessions} onChange={(v) => update({ showSessions: v })} />
            <Toggle
              label="Highlight trading window"
              value={settings.showTradingWindow}
              onChange={(v) => update({ showTradingWindow: v })}
            />
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">Drawing</h2>
            <Toggle label="Magnet to candle OHLC" value={settings.magnetToOHLC} onChange={(v) => update({ magnetToOHLC: v })} />
            <Toggle
              label="Keep tool active after drawing"
              value={settings.keepToolActive}
              onChange={(v) => update({ keepToolActive: v })}
            />
          </section>

          <section className="space-y-2">
            <h2 className="eyebrow">Account</h2>
            <Field label="Trader name">
              <input
                className="panel-input"
                value={settings.traderName}
                placeholder="Your name"
                onChange={(e) => update({ traderName: e.target.value })}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Sessions, journal and settings are stored on this device. Cloud sync can be added later.
            </p>
          </section>

          <button type="button" className="touch-btn w-full border border-border text-sm" onClick={reset}>
            Reset to defaults
          </button>
        </div>
      </div>
    </AppShell>
  );
}
