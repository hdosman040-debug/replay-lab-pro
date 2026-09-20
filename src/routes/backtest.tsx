import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { WORKFLOW_STEPS } from "@/lib/backtest/types";

export const Route = createFileRoute("/backtest")({
  head: () => ({
    meta: [
      { title: "Backtest workflow — ICT Trade Terminal" },
      { name: "description", content: "The manual US30 backtesting loop, step by step, from context to journal." },
      { property: "og:title", content: "Backtest workflow — ICT Trade Terminal" },
      { property: "og:description", content: "The manual US30 backtesting loop, step by step, from context to journal." },
    ],
  }),
  component: BacktestPage,
});

const PHASES = [
  { title: "Read the market", ids: ["context", "liquidity", "dol", "poi"] },
  { title: "Let price speak", ids: ["wait", "sweep", "displacement", "mss"] },
  { title: "Decide and measure", ids: ["plan", "replay", "record", "journal"] },
];

function BacktestPage() {
  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <PageHeader title="Backtest" subtitle="The loop you repeat, opportunity after opportunity" />
        <div className="space-y-4 p-3">
          <p className="text-xs text-muted-foreground">
            Nothing here is detected for you. Every liquidity level, sweep, displacement and
            structure shift is yours to mark — the terminal only replays price and measures what
            you decided.
          </p>
          {PHASES.map((phase) => (
            <section key={phase.title} className="rounded-lg border border-border bg-surface p-3">
              <h2 className="eyebrow mb-2">{phase.title}</h2>
              <ol className="space-y-1.5">
                {phase.ids.map((id) => {
                  const step = WORKFLOW_STEPS.find((s) => s.id === id);
                  const n = WORKFLOW_STEPS.findIndex((s) => s.id === id) + 1;
                  return (
                    <li key={id} className="flex items-center gap-3 text-sm">
                      <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-muted-foreground">
                        {n}
                      </span>
                      {step?.label}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <Link
            to="/"
            className="touch-btn flex w-full items-center justify-center font-semibold"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Go to the replay workspace
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
