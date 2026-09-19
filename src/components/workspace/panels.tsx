import type { ReactNode } from "react";

import {
  rrRatio,
  riskDistance,
  rewardDistance,
  WORKFLOW_STEPS,
  type Analysis,
  type Bias,
  type PremiumDiscount,
  type ReplaySession,
  type TradePlan,
  type WorkflowStepId,
} from "@/lib/backtest/types";

/* ---------- small controls ---------- */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <input
        className="panel-input num"
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip"
            data-active={value === o.id}
            onClick={() => onChange(value === o.id ? ("" as T) : o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

const BIAS: { id: Bias; label: string }[] = [
  { id: "bullish", label: "Bullish" },
  { id: "bearish", label: "Bearish" },
  { id: "neutral", label: "Neutral" },
];
const PD: { id: PremiumDiscount; label: string }[] = [
  { id: "premium", label: "Premium" },
  { id: "discount", label: "Discount" },
  { id: "equilibrium", label: "Equilibrium" },
];

/* ---------- workflow ---------- */

export function WorkflowPanel({
  session,
  onToggle,
}: {
  session: ReplaySession;
  onToggle: (id: WorkflowStepId) => void;
}) {
  const done = session.workflowDone;
  return (
    <div className="space-y-1.5 p-3">
      <p className="text-xs text-muted-foreground">
        A checklist, not a guide — nothing is detected for you. Tick steps as you do them.
      </p>
      {WORKFLOW_STEPS.map((s, i) => {
        const isDone = done.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onToggle(s.id)}
            className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left"
            style={{ backgroundColor: isDone ? "var(--surface-3)" : "var(--surface)" }}
          >
            <span
              className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: isDone ? "var(--primary)" : "var(--surface-3)",
                color: isDone ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {isDone ? "✓" : i + 1}
            </span>
            <span className="text-sm" style={{ color: isDone ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- analysis ---------- */

export function AnalysisPanel({
  analysis,
  onChange,
}: {
  analysis: Analysis;
  onChange: (fn: (a: Analysis) => Analysis) => void;
}) {
  const set = <K extends keyof Analysis>(k: K, v: Analysis[K]) => onChange((a) => ({ ...a, [k]: v }));
  const setLiq = (k: keyof Analysis["liquidity"], v: string) =>
    onChange((a) => ({ ...a, liquidity: { ...a.liquidity, [k]: v } }));
  const setStr = (k: keyof Analysis["structure"], v: string) =>
    onChange((a) => ({ ...a, structure: { ...a.structure, [k]: v } }));
  const setSetup = (k: keyof Analysis["setup"], v: string) =>
    onChange((a) => ({ ...a, setup: { ...a.setup, [k]: v } }));

  return (
    <div className="space-y-4 p-3">
      <section className="space-y-2.5">
        <h3 className="eyebrow">Market context</h3>
        <Choice label="HTF bias" value={analysis.htfBias} options={BIAS} onChange={(v) => set("htfBias", v)} />
        <Choice label="Current bias" value={analysis.currentBias} options={BIAS} onChange={(v) => set("currentBias", v)} />
        <Choice
          label="Premium / discount"
          value={analysis.premiumDiscount}
          options={PD}
          onChange={(v) => set("premiumDiscount", v)}
        />
        <div className="grid grid-cols-3 gap-2">
          <TextField label="DOL" value={analysis.dol} onChange={(v) => set("dol", v)} />
          <TextField label="ERL" value={analysis.erl} onChange={(v) => set("erl", v)} />
          <TextField label="IRL" value={analysis.irl} onChange={(v) => set("irl", v)} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="eyebrow">Liquidity</h3>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="BSL" value={analysis.liquidity.bsl} onChange={(v) => setLiq("bsl", v)} />
          <TextField label="SSL" value={analysis.liquidity.ssl} onChange={(v) => setLiq("ssl", v)} />
          <TextField label="PDH" value={analysis.liquidity.pdh} onChange={(v) => setLiq("pdh", v)} />
          <TextField label="PDL" value={analysis.liquidity.pdl} onChange={(v) => setLiq("pdl", v)} />
          <TextField label="Asia high" value={analysis.liquidity.asiaHigh} onChange={(v) => setLiq("asiaHigh", v)} />
          <TextField label="Asia low" value={analysis.liquidity.asiaLow} onChange={(v) => setLiq("asiaLow", v)} />
          <TextField label="London high" value={analysis.liquidity.londonHigh} onChange={(v) => setLiq("londonHigh", v)} />
          <TextField label="London low" value={analysis.liquidity.londonLow} onChange={(v) => setLiq("londonLow", v)} />
          <TextField label="Session high" value={analysis.liquidity.sessionHigh} onChange={(v) => setLiq("sessionHigh", v)} />
          <TextField label="Session low" value={analysis.liquidity.sessionLow} onChange={(v) => setLiq("sessionLow", v)} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="eyebrow">Structure</h3>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="HH" value={analysis.structure.hh} onChange={(v) => setStr("hh", v)} />
          <TextField label="HL" value={analysis.structure.hl} onChange={(v) => setStr("hl", v)} />
          <TextField label="LH" value={analysis.structure.lh} onChange={(v) => setStr("lh", v)} />
          <TextField label="LL" value={analysis.structure.ll} onChange={(v) => setStr("ll", v)} />
        </div>
        <TextField label="MSS" value={analysis.structure.mss} onChange={(v) => setStr("mss", v)} />
      </section>

      <section className="space-y-2">
        <h3 className="eyebrow">Setup</h3>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Sweep" value={analysis.setup.sweep} onChange={(v) => setSetup("sweep", v)} />
          <TextField label="Displacement" value={analysis.setup.displacement} onChange={(v) => setSetup("displacement", v)} />
          <TextField label="FVG" value={analysis.setup.fvg} onChange={(v) => setSetup("fvg", v)} />
          <TextField label="Order block" value={analysis.setup.ob} onChange={(v) => setSetup("ob", v)} />
        </div>
        <TextField label="Setup type" value={analysis.setup.setupType} onChange={(v) => setSetup("setupType", v)} />
        <Choice
          label="Direction"
          value={analysis.setup.direction}
          options={[
            { id: "long", label: "Long" },
            { id: "short", label: "Short" },
          ]}
          onChange={(v) => setSetup("direction", v)}
        />
      </section>

      <section className="space-y-2">
        <h3 className="eyebrow">Reasoning</h3>
        <Field label="Analysis notes">
          <textarea className="panel-input min-h-20" value={analysis.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <Field label={`Confidence: ${analysis.confidence}/5`}>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            className="w-full"
            value={analysis.confidence}
            onChange={(e) => set("confidence", Number(e.target.value))}
          />
        </Field>
        <Field label="Reason for trade">
          <textarea
            className="panel-input min-h-16"
            value={analysis.reasonForTrade}
            onChange={(e) => set("reasonForTrade", e.target.value)}
          />
        </Field>
        <Field label="Reason for no trade">
          <textarea
            className="panel-input min-h-16"
            value={analysis.reasonForNoTrade}
            onChange={(e) => set("reasonForNoTrade", e.target.value)}
          />
        </Field>
      </section>
    </div>
  );
}

/* ---------- trade planner ---------- */

export function TradePanel({
  trade,
  lastPrice,
  onCreate,
  onPatch,
  onRemove,
  onRecord,
  onNoTrade,
}: {
  trade: TradePlan | null;
  lastPrice: number | null;
  onCreate: (direction: "long" | "short") => void;
  onPatch: (patch: Partial<TradePlan>) => void;
  onRemove: () => void;
  onRecord: () => void;
  onNoTrade: () => void;
}) {
  if (!trade) {
    return (
      <div className="space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Plan a hypothetical trade. Levels are yours — the terminal only measures them.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="touch-btn border border-border font-semibold"
            style={{ color: "var(--bull)" }}
            onClick={() => onCreate("long")}
          >
            Plan long
          </button>
          <button
            type="button"
            className="touch-btn border border-border font-semibold"
            style={{ color: "var(--bear)" }}
            onClick={() => onCreate("short")}
          >
            Plan short
          </button>
        </div>
        <button type="button" className="touch-btn w-full border border-border text-sm" onClick={onNoTrade}>
          Record a no-trade decision
        </button>
        {lastPrice !== null && (
          <p className="num text-xs text-muted-foreground">Last price {lastPrice.toFixed(1)}</p>
        )}
      </div>
    );
  }

  const rr = rrRatio(trade);
  const num = (k: "entry" | "stopLoss" | "takeProfit", label: string) => (
    <Field label={label}>
      <input
        type="number"
        step="0.1"
        className="panel-input num"
        value={trade[k]}
        onChange={(e) => onPatch({ [k]: Number(e.target.value) } as Partial<TradePlan>)}
      />
    </Field>
  );

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span
          className="chip"
          data-active="true"
          style={{
            backgroundColor: trade.direction === "long" ? "var(--bull)" : "var(--bear)",
            borderColor: "transparent",
            color: "var(--background)",
          }}
        >
          {trade.direction === "long" ? "LONG" : "SHORT"}
        </span>
        <span className="text-xs text-muted-foreground">{trade.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {num("entry", "Entry")}
        {num("stopLoss", "Stop loss")}
        {num("takeProfit", "Take profit")}
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface p-2 text-center">
        <Stat label="Risk" value={riskDistance(trade).toFixed(1)} />
        <Stat label="Reward" value={rewardDistance(trade).toFixed(1)} />
        <Stat label="R:R" value={rr.toFixed(2)} />
      </div>
      {trade.resultR !== undefined && (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface p-2 text-center">
          <Stat label="Result" value={trade.result ?? "—"} />
          <Stat label="Result R" value={trade.resultR.toFixed(2)} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Drag the lines on the chart to adjust levels.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="touch-btn border border-border text-sm" onClick={onRemove}>
          Discard plan
        </button>
        <button
          type="button"
          className="touch-btn text-sm font-semibold"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={onRecord}
        >
          Record result
        </button>
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num text-sm font-semibold">{value}</div>
    </div>
  );
}
