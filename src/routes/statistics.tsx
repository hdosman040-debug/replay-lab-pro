import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { computeStats } from "@/lib/backtest/stats";
import { selectJournalExecutions } from "@/lib/backtest/uniqueJournalExecutions";
import { NO_TRADE_REASONS } from "@/lib/backtest/types";
import { useJournalStore } from "@/lib/store/journalStore";
import { useStoresHydrated } from "@/lib/store/hydrate";
import {
  computeDemoAccount,
  computePropaniumOneStepAccount,
  DEMO_RISK_PER_TRADE,
  PROPANIUM_ONE_STEP_2500,
} from "@/lib/backtest/account";
import { useSettingsStore } from "@/lib/store/settingsStore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: "Statistics — Replay Lab Pro" },
      {
        name: "description",
        content: "Self-review numbers from your manually recorded US30 backtests.",
      },
      { property: "og:title", content: "Statistics — Replay Lab Pro" },
      {
        property: "og:description",
        content: "Self-review numbers from your manually recorded US30 backtests.",
      },
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

function Dist({
  title,
  data,
  labels,
}: {
  title: string;
  data: Record<string, number>;
  labels?: Record<string, string>;
}) {
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
              <div
                className="h-full rounded-full"
                style={{ width: `${(v / max) * 100}%`, backgroundColor: "var(--primary)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num text-sm font-semibold">{value}</div>
    </div>
  );
}

function StatsPage() {
  const ready = useStoresHydrated();
  const records = useJournalStore((s) => s.records);
  const selection = useMemo(() => selectJournalExecutions(records), [records]);
  const s = useMemo(() => computeStats(records), [records]);
  const account = useMemo(() => computeDemoAccount(records), [records]);
  const challengeRiskPercent = useSettingsStore((s) => s.settings.propaniumRiskPercent);
  const challengeStartedAt = useSettingsStore((s) => s.settings.propaniumChallengeStartedAt);
  const updateSettings = useSettingsStore((s) => s.update);
  const challenge = useMemo(
    () => computePropaniumOneStepAccount(records, challengeRiskPercent, challengeStartedAt),
    [records, challengeRiskPercent, challengeStartedAt],
  );
  const reasonLabels = Object.fromEntries(NO_TRADE_REASONS.map((r) => [r.id, r.label]));

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <PageHeader title="Statistics" subtitle="Research and self-review — never a signal" />
        <div className="space-y-3 p-3">
          {ready && selection.ambiguousExecutionCount > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/50 bg-surface p-3 text-sm"
            >
              <div className="font-semibold">Journal integrity warning</div>
              <p className="mt-1 text-muted-foreground">
                {selection.ambiguousExecutionCount} trade execution(s) have conflicting historical
                records and are excluded from performance calculations. The original journal records
                have not been deleted.
              </p>
            </div>
          )}
          {ready && s.total === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No records yet. Statistics appear once you record results and no-trade decisions.
            </p>
          )}
          <section className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="eyebrow">Demo account</h2>
                <div className="num mt-1 text-2xl font-semibold">${account.balance.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  Started at $1,000 · $25 risk per trade · 2.5%
                </div>
              </div>

              <div className="text-right">
                <div
                  className="num text-sm font-semibold"
                  style={{ color: account.totalPnl >= 0 ? "var(--bull)" : "var(--bear)" }}
                >
                  {account.totalPnl >= 0 ? "+" : ""}${account.totalPnl.toFixed(2)}
                </div>
                <div className="num text-xs text-muted-foreground">
                  {account.returnPercent >= 0 ? "+" : ""}
                  {account.returnPercent.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="Risk" value={`$${DEMO_RISK_PER_TRADE.toFixed(0)}`} />
              <Stat label="Max DD" value={`$${account.maxDrawdown.toFixed(2)}`} />
              <Stat label="DD %" value={`${account.maxDrawdownPercent.toFixed(2)}%`} />
            </div>

            {account.points.length > 1 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={account.points}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="trade"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      width={55}
                      tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--foreground)",
                      }}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, "Balance"]}
                      labelFormatter={(label) => `Trade ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Record a trade to start the $1,000 account equity curve.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="eyebrow">Propanium · $2,500 ONE-STEP</h2>
                <div className="num mt-1 text-2xl font-semibold">${challenge.balance.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  Target ${challenge.targetBalance.toFixed(0)} · max loss floor ${challenge.maximumDrawdownFloor.toFixed(0)} · daily reset 00:00 {PROPANIUM_ONE_STEP_2500.dailyResetTimezone}
                </div>
              </div>
              <div
                className="rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={{
                  borderColor: challenge.state === "breached" ? "var(--bear)" : challenge.state === "passed" ? "var(--bull)" : "var(--border)",
                  color: challenge.state === "breached" ? "var(--bear)" : challenge.state === "passed" ? "var(--bull)" : "var(--muted-foreground)",
                }}
              >
                {challenge.state === "not_started" ? "Ready to start" : challenge.state === "active" ? "In progress" : challenge.state === "passed" ? "Target reached" : "Rule breached"}
              </div>
            </div>

            <button
              type="button"
              className="touch-btn mb-3 w-full border border-border text-sm"
              onClick={() => {
                if (challengeStartedAt !== null && !window.confirm("Restart this challenge? Its current replay run will be reset.")) return;
                updateSettings({ propaniumChallengeStartedAt: Date.now() });
              }}
            >
              {challengeStartedAt === null ? "Start challenge replay" : "Restart challenge replay"}
            </button>

            <label className="mb-3 flex items-center justify-between gap-3 text-xs">
              <span>Risk per trade (% of current balance)</span>
              <input
                className="panel-input num w-24 text-right"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={challengeRiskPercent}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value >= 0.1 && value <= 10) {
                    updateSettings({ propaniumRiskPercent: value });
                  }
                }}
                aria-label="Challenge risk per trade percent"
              />
            </label>

            <div className="mb-1 flex justify-between text-xs">
              <span>Profit target progress</span>
              <span className="num">{challenge.returnPercent.toFixed(2)}% / {PROPANIUM_ONE_STEP_2500.profitTargetPercent}%</span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${challenge.targetProgressPercent}%`, backgroundColor: "var(--primary)" }} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <Stat label="Daily loss used" value={`$${challenge.dailyLossUsed.toFixed(2)} / $${challenge.dailyLossLimit.toFixed(2)}`} />
              <Stat label="Trades counted" value={String(challenge.tradesProcessed)} />
            </div>

            {challenge.state === "breached" && (
              <p role="alert" className="mt-3 text-xs" style={{ color: "var(--bear)" }}>
                {challenge.breachReason === "daily_drawdown" ? "Daily drawdown limit reached." : "Maximum drawdown limit reached."}
              </p>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Counts trades journaled after this run starts. This estimates the target and drawdown rules from replay records; it does not reproduce broker fills, costs, Smart Exit, news windows, or inactivity enforcement.
            </p>
          </section>

          <div className="grid grid-cols-3 gap-2">
            <Tile label="Trades" value={String(s.trades)} />
            <Tile label="No-trades" value={String(s.noTrades)} />
            <Tile label="Win rate" value={`${s.winRate.toFixed(0)}%`} />
            <Tile label="Wins" value={String(s.wins)} tone="var(--bull)" />
            <Tile label="Losses" value={String(s.losses)} tone="var(--bear)" />
            <Tile label="Breakeven" value={String(s.breakeven)} />
            <Tile
              label="Total R"
              value={s.totalR.toFixed(2)}
              tone={s.totalR >= 0 ? "var(--bull)" : "var(--bear)"}
            />
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
