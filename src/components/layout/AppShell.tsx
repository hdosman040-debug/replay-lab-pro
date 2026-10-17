import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  Database,
  FlaskConical,
  Menu,
  Settings2,
  X,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Replay", icon: Activity },
  { to: "/backtest", label: "Backtest", icon: FlaskConical },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/data", label: "Market Data", icon: Database },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

const MOBILE_NAV = NAV.slice(0, 4);
const MORE_NAV = NAV.slice(4);

function isActive(path: string, to: string) {
  return to === "/" ? path === "/" : path === to || path.startsWith(to + "/");
}

export function AppShell({
  children,
  chrome = true,
}: {
  children: ReactNode;
  chrome?: boolean;
}) {
  const path = useRouterState({
    select: (state) => state.location.pathname,
  });

  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  const moreActive = MORE_NAV.some((item) => isActive(path, item.to));

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      {chrome && (
        <aside
          aria-label="Main navigation"
          className="hidden w-[224px] shrink-0 flex-col border-r border-border bg-surface lg:flex"
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-xl font-black text-primary">
              R
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight">
                Replay Lab <span className="text-primary">Pro</span>
              </div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Research terminal
              </div>
            </div>
          </div>

          <div className="px-4 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workspace
          </div>

          <nav className="flex flex-col gap-1 px-3">
            {NAV.map((item) => {
              const active = isActive(path, item.to);
              const Icon = item.icon;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors " +
                    (active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-3 hover:text-foreground")
                  }
                >
                  <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight size={15} aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-border p-5">
            <div className="text-xs font-semibold">Replay Lab Pro</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Historical market research
            </div>
          </div>
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>

        {chrome && (
          <>
            {moreOpen && (
              <div className="relative lg:hidden">
                <button
                  type="button"
                  aria-label="Close more menu"
                  className="fixed inset-0 z-30 bg-black/50"
                  onClick={() => setMoreOpen(false)}
                />

                <div
                  role="dialog"
                  aria-label="More navigation"
                  className="absolute bottom-0 left-0 right-0 z-40 rounded-t-2xl border border-border bg-surface-2 p-4 shadow-2xl"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-bold">More pages</div>
                    <button
                      type="button"
                      aria-label="Close menu"
                      onClick={() => setMoreOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3"
                    >
                      <X size={19} />
                    </button>
                  </div>

                  <nav className="grid gap-2">
                    {MORE_NAV.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(path, item.to);

                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={
                            "flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium " +
                            (active
                              ? "bg-primary/10 text-primary"
                              : "bg-surface text-foreground")
                          }
                        >
                          <Icon size={19} />
                          {item.label}
                          <ChevronRight
                            size={16}
                            className="ml-auto text-muted-foreground"
                          />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>
            )}

            <nav
              aria-label="Mobile navigation"
              className="safe-bottom flex shrink-0 items-stretch border-t border-border bg-surface px-1 pt-1 lg:hidden"
            >
              {MOBILE_NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(path, item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={
                      "flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition-colors " +
                      (active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground")
                    }
                  >
                    <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                    <span>{item.label === "Statistics" ? "Stats" : item.label}</span>
                  </Link>
                );
              })}

              <button
                type="button"
                aria-label="More pages"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((value) => !value)}
                className={
                  "flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold " +
                  (moreOpen || moreActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground")
                }
              >
                {moreOpen ? <X size={20} /> : <Menu size={20} />}
                <span>More</span>
              </button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex min-h-[62px] items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-base font-bold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
