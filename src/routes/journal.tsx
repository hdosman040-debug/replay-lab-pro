import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { NO_TRADE_REASONS, rrRatio, type JournalRecord } from "@/lib/backtest/types";
import { useJournalStore } from "@/lib/store/journalStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useStoresHydrated } from "@/lib/store/hydrate";
import { fmtDateTime } from "@/lib/time/ny";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Journal — ICT Trade Terminal" },
      { name: "description", content: "Every recorded US30 decision: trades taken, trades skipped, and why." },
      { property: "og:title", content: "Journal — ICT Trade Terminal" },
      { property: "og:description", content: "Every recorded US30 decision: trades taken, trades skipped, and why." },
    ],
  }),
  component: JournalPage,
});

type Filter = "all" | "trade" | "no_trade";

function JournalPage() {
  const ready = useStoresHydrated();
  const records = useJournalStore((s) => s.records);
  const remove = useJournalStore((s) => s.remove);
  const update = useJournalStore((s) => s.update);
  const tz = useSettingsStore((s) => s.settings.sessionTimezone);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = records.filter((r) => filter === "all" || r.kind === filter);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <PageHeader title="Journal" subtitle={`${records.length} recorded decisions`} />
        <div className="flex gap-1.5 border-b border-border bg-surface px-3 py-2">
          {(["all", "trade", "no_trade"] as Filter[]).map((f) => (
            <button key={f} type="button" className="chip" data-active={filter === f} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "trade" ? "Trades" : "No-trades"}
            </button>
          ))}
        </div>
        {!ready ? null : list.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nothing recorded yet. Record a result or a no-trade decision from the replay workspace.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-3 text-left"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                >
                  <Badge record={r} />
                  <span className="min-w-0 flex-1">
                    <span className="num block text-sm">{fmtDateTime(r.decisionTime, tz)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.symbol} {r.timeframe} · {r.session} · {summary(r)}
                    </span>
                  </span>
                </button>
                {openId === r.id && (
                  <Detail record={r} tz={tz} onRemove={() => remove(r.id)} onNotes={(notes) => update(r.id, { notes })} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function summary(r: JournalRecord) {
  if (r.kind === "no_trade") {
    return NO_TRADE_REASONS.find((x) => x.id === r.noTradeReason)?.label ?? "No trade";
  }
  const t = r.trade;
  if (!t) return "Trade";
  return `${t.direction} · R:R ${rrRatio(t).toFixed(2)} · ${t.resultR?.toFixed(2) ?? "—"}R`;
}

function Badge({ record }: { record: JournalRecord }) {
  const color =
    record.kind === "no_trade"
      ? "var(--muted-foreground)"
      : record.trade?.result === "win"
        ? "var(--bull)"
        : record.trade?.result === "loss"
          ? "var(--bear)"
          : "var(--warn)";
  const text =
    record.kind === "no_trade" ? "NT" : record.trade?.result === "win" ? "W" : record.trade?.result === "loss" ? "L" : "BE";
  return (
    <span
      className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
      style={{ backgroundColor: color, color: "var(--background)" }}
    >
      {text}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="num text-xs">{value}</span>
    </div>
  );
}

function Detail({
  record,
  tz,
  onRemove,
  onNotes,
}: {
  record: JournalRecord;
  tz: string;
  onRemove: () => void;
  onNotes: (v: string) => void;
}) {
  const a = record.analysis;
  const t = record.trade;
  return (
    <div className="space-y-3 border-t border-border bg-surface px-3 py-3">
      <section>
        <h3 className="eyebrow mb-1">Context</h3>
        <Row label="Recorded" value={fmtDateTime(record.createdAt / 1000, tz)} />
        <Row label="HTF bias" value={a.htfBias} />
        <Row label="Current bias" value={a.currentBias} />
        <Row label="DOL" value={a.dol} />
        <Row label="Premium / discount" value={a.premiumDiscount} />
        <Row label="Confidence" value={`${a.confidence}/5`} />
      </section>
      <section>
        <h3 className="eyebrow mb-1">Setup</h3>
        <Row label="Sweep" value={a.setup.sweep} />
        <Row label="Displacement" value={a.setup.displacement} />
        <Row label="MSS" value={a.structure.mss} />
        <Row label="FVG" value={a.setup.fvg} />
        <Row label="Order block" value={a.setup.ob} />
        <Row label="Setup type" value={a.setup.setupType} />
      </section>
      {t && (
        <section>
          <h3 className="eyebrow mb-1">Trade</h3>
          <Row label="Direction" value={t.direction} />
          <Row label="Entry" value={t.entry.toFixed(1)} />
          <Row label="Stop loss" value={t.stopLoss.toFixed(1)} />
          <Row label="Take profit" value={t.takeProfit.toFixed(1)} />
          <Row label="R:R" value={rrRatio(t).toFixed(2)} />
          <Row label="Result" value={t.result ?? ""} />
          <Row label="Result R" value={t.resultR !== undefined ? t.resultR.toFixed(2) : ""} />
        </section>
      )}
      {record.kind === "no_trade" && (
        <Row label="Reason" value={NO_TRADE_REASONS.find((x) => x.id === record.noTradeReason)?.label ?? ""} />
      )}
      <Row label="Reason for trade" value={a.reasonForTrade} />
      <Row label="Reason for no trade" value={a.reasonForNoTrade} />
      <Row label="Mistakes" value={record.mistakes} />
      <label className="block">
        <span className="eyebrow mb-1 block">Notes</span>
        <textarea className="panel-input min-h-16" value={record.notes} onChange={(e) => onNotes(e.target.value)} />
      </label>
      <p className="text-xs text-muted-foreground">{record.drawings.length} drawings saved with this decision.</p>
      <button type="button" className="touch-btn w-full border border-border text-sm" onClick={onRemove}>
        Delete record
      </button>
    </div>
  );
}
