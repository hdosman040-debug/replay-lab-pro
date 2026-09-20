import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { getMarketDataProvider } from "@/lib/market";
import type { DatasetInfo } from "@/lib/market/types";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useStoresHydrated } from "@/lib/store/hydrate";
import { fmtDateTime } from "@/lib/time/ny";

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data — ICT Trade Terminal" },
      { name: "description", content: "Available US30 datasets, timeframes, coverage and candle counts." },
      { property: "og:title", content: "Data — ICT Trade Terminal" },
      { property: "og:description", content: "Available US30 datasets, timeframes, coverage and candle counts." },
    ],
  }),
  component: DataPage,
});

function DataPage() {
  const ready = useStoresHydrated();
  const tz = useSettingsStore((s) => s.settings.sessionTimezone);
  const [sets, setSets] = useState<DatasetInfo[] | null>(null);

  useEffect(() => {
    let alive = true;
    getMarketDataProvider()
      .listDatasets()
      .then((d) => alive && setSets(d))
      .catch(() => alive && setSets([]));
    return () => {
      alive = false;
    };
  }, []);

  const provider = getMarketDataProvider().id;

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <PageHeader title="Data" subtitle={`Provider: ${provider}`} />
        <div className="space-y-3 p-3">
          <p className="text-xs text-muted-foreground">
            The terminal reads price through a single data door, so real US30 history can be
            plugged in later without touching the replay engine.
          </p>
          {!sets || !ready ? (
            <p className="text-sm text-muted-foreground">Loading datasets…</p>
          ) : sets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No datasets available.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-3 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">TF</th>
                    <th className="px-2 py-2">Candles</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sets.map((d) => (
                    <tr key={`${d.symbol}-${d.timeframe}`} className="border-t border-border bg-surface align-top">
                      <td className="num px-2 py-2">{d.symbol}</td>
                      <td className="num px-2 py-2">{d.timeframe}</td>
                      <td className="num px-2 py-2">
                        {d.candleCount.toLocaleString()}
                        <div className="text-[10px] text-muted-foreground">
                          {d.earliest ? fmtDateTime(d.earliest, tz) : "—"}
                          <br />
                          {d.latest ? fmtDateTime(d.latest, tz) : "—"}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="chip"
                          data-active={d.status === "ready"}
                          style={{ color: d.status === "ready" ? "var(--bull)" : undefined }}
                        >
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <section className="rounded-lg border border-border bg-surface p-3">
            <h2 className="eyebrow mb-1">Connecting real data later</h2>
            <p className="text-xs text-muted-foreground">
              A future cloud-backed source will expose the same fields — symbol, timeframe,
              timestamp, open, high, low, close, volume in UTC — loaded in ranges, never as one
              huge download. Nothing else in the app has to change.
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
