import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Replay" },
  { to: "/backtest", label: "Backtest" },
  { to: "/journal", label: "Journal" },
  { to: "/statistics", label: "Stats" },
  { to: "/data", label: "Data" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children, chrome = true }: { children: ReactNode; chrome?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {chrome && (
        <nav className="safe-bottom flex shrink-0 items-stretch gap-0.5 border-t border-border bg-surface px-1 pt-1">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex flex-1 flex-col items-center justify-center rounded-md py-1.5 text-[11px] font-medium"
                style={{
                  color: active ? "var(--primary)" : "var(--muted-foreground)",
                  backgroundColor: active ? "var(--surface-3)" : "transparent",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
