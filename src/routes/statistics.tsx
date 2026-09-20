import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { computeStats } from "@/lib/backtest/stats";
import { NO_TRADE_REASONS } from "@/lib/backtest/types";
import { useJournalStore } from "@/lib/store/journalStore";
import { useStoresHydrated } from "@/lib/store/hydrate";

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: "Statistics — ICT Trade Terminal" },
      { name: "description", content: "Self-review numbers from your manually recorded US30 backtests." },
      { property: "og:title", content: "Statistics — ICT Trade Terminal" },
      { property: "og:description", content: "Self-review numbers from your manually recorded US30 backtests." },
    ],
  }),
  component: StatsPage,
});

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="eyebrow">{label}</div>
      <div className="num text-lg font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

function Dist({ title, data, labels }: { title: string; data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const max = Math.max(...entries.map((e) => e[1]));
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h2 className="eyebrow mb-2">{title}</h2>
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs">
              <span>{labels?.[k] ?? k}</span>
              <span className="num text-muted-foreground">{v}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, backgroundColor: "var(--primary)" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsPage() {
  const ready = useStoresHydrated();
  const records = useJournalStore((s) => s.records);
  const s = useMemo(() => computeStats(records), [records]);
  const reasonLabels = Object.fromEntries(NO_TRADE_REASONS.map((r) => [r.id, r.label]));

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <PageHeader title="Statistics" subtitle="Research and self-review — never a signal" />
        <div className="space-y-3 p-3">
          {ready && s.total === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No records yet. Statistics appear once you record results and no-trade decisions.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Trades" value={String(s.trades)} />
            <Tile label="No-trades" value={String(s.noTrades)} />
            <Tile label="Win rate" value={`${s.winRate.toFixed(0)}%`} />
            <Tile label="Wins" value={String(s.wins)} tone="var(--bull)" />
            <Tile label="Losses" value={String(s.losses)} tone="var(--bear)" />
            <Tile label="Breakeven" value={String(s.breakeven)} />
            <Tile label="Total R" value={s.totalR.toFixed(2)} tone={s.totalR >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Tile label="Average R" value={s.avgR.toFixed(2)} />
            <Tile label="Avg win" value={s.avgWin.toFixed(2)} />
            <Tile label="Avg loss" value={s.avgLoss.toFixed(2)} />
            <Tile label="Largest win" value={s.largestWin.toFixed(2)} />
            <Tile label="Largest loss" value={s.largestLoss.toFixed(2)} />
            <Tile label="Win streak" value={String(s.maxWinStreak)} />
            <Tile label="Loss streak" value={String(s.maxLossStreak)} />
          </div>
          <Dist title="By setup type" data={s.bySetup} />
          <Dist title="By direction" data={s.byDirection} />
          <Dist title="By session" data={s.bySession} />
          <Dist title="No-trade reasons" data={s.byNoTradeReason} labels={reasonLabels} />
        </div>
      </div>
    </AppShell>
  );
}
