import { useState } from "react";

import { Sheet } from "@/components/layout/Sheet";
import { Field, Stat } from "@/components/workspace/panels";
import {
  NO_TRADE_REASONS,
  resultRAt,
  rrRatio,
  type JournalRecord,
  type NoTradeReason,
  type ReplaySession,
  type TradeResult,
} from "@/lib/backtest/types";
import { TIMEFRAMES, type Timeframe } from "@/lib/market/types";
import { SPEEDS } from "@/lib/replay/engine";
import { uid } from "@/lib/store/sessionStore";
import { fmtDateISO, fmtDateTime, fmtTimeISO, sessionAt, SESSION_LABEL, zonedToUtc, type SessionWindows } from "@/lib/time/ny";

function parseDateTime(date: string, time: string, tz: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return zonedToUtc(y, m, d, hh, mm, tz);
}

/* ---------- new session ---------- */

export function NewSessionSheet({
  open,
  tz,
  defaultTimeframe,
  defaultSpeed,
  onClose,
  onCreate,
}: {
  open: boolean;
  tz: string;
  defaultTimeframe: Timeframe;
  defaultSpeed: number;
  onClose: () => void;
  onCreate: (input: { name: string; timeframe: Timeframe; startTime: number; speed: number }) => void;
}) {
  const [name, setName] = useState("");
  const [tf, setTf] = useState<Timeframe>(defaultTimeframe);
  const [date, setDate] = useState("2024-03-05");
  const [time, setTime] = useState("09:30");
  const [speed, setSpeed] = useState(defaultSpeed);

  const start = parseDateTime(date, time, tz);

  return (
    <Sheet open={open} title="New replay session" onClose={onClose}>
      <div className="space-y-3 p-3">
        <Field label="Session name (optional)">
          <input className="panel-input" value={name} placeholder="US30 NY open" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Symbol">
          <div className="flex gap-1.5">
            <button type="button" className="chip" data-active="true">
              US30
            </button>
          </div>
        </Field>
        <Field label="Replay timeframe">
          <div className="flex flex-wrap gap-1.5">
            {TIMEFRAMES.map((t) => (
              <button key={t} type="button" className="chip" data-active={tf === t} onClick={() => setTf(t)}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start date">
            <input className="panel-input num" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={`Start time (${tz.split("/")[1] ?? tz})`}>
            <input className="panel-input num" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Replay speed">
          <div className="flex flex-wrap gap-1.5">
            {SPEEDS.map((s) => (
              <button key={s} type="button" className="chip num" data-active={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs text-muted-foreground">
          Replay begins at this moment. Nothing after it will ever be shown until you advance.
        </p>
        <button
          type="button"
          disabled={!start}
          className="touch-btn w-full font-semibold disabled:opacity-40"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={() => start && onCreate({ name, timeframe: tf, startTime: start, speed })}
        >
          Start replay
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- sessions list ---------- */

export function SessionsSheet({
  open,
  sessions,
  activeId,
  tz,
  onClose,
  onSelect,
  onDelete,
  onNew,
}: {
  open: boolean;
  sessions: ReplaySession[];
  activeId: string | null;
  tz: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <Sheet open={open} title="Replay sessions" onClose={onClose}>
      <div className="space-y-2 p-3">
        <button
          type="button"
          className="touch-btn w-full font-semibold"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={onNew}
        >
          New session
        </button>
        {sessions.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No saved sessions yet.</p>}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-md border border-border p-2.5"
            style={{ backgroundColor: s.id === activeId ? "var(--surface-3)" : "var(--surface)" }}
          >
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(s.id)}>
              <div className="truncate text-sm font-medium">{s.name}</div>
              <div className="num text-xs text-muted-foreground">
                {s.symbol} {s.timeframe} · {fmtDateTime(s.currentTime, tz)}
              </div>
            </button>
            <button type="button" className="chip" onClick={() => onDelete(s.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------- jump to ---------- */

export function JumpToSheet({
  open,
  current,
  tz,
  onClose,
  onJump,
  onReset,
}: {
  open: boolean;
  current: number;
  tz: string;
  onClose: () => void;
  onJump: (t: number) => void;
  onReset: () => void;
}) {
  const [date, setDate] = useState(fmtDateISO(current, tz));
  const [time, setTime] = useState(fmtTimeISO(current, tz));
  const target = parseDateTime(date, time, tz);
  return (
    <Sheet open={open} title="Jump replay clock" onClose={onClose}>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date">
            <input className="panel-input num" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time">
            <input className="panel-input num" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <button
          type="button"
          disabled={!target}
          className="touch-btn w-full font-semibold disabled:opacity-40"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={() => target && onJump(target)}
        >
          Jump
        </button>
        <button type="button" className="touch-btn w-full border border-border text-sm" onClick={onReset}>
          Reset to session start
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- record result ---------- */

export function RecordResultSheet({
  open,
  session,
  sessions,
  tz,
  onClose,
  onSave,
}: {
  open: boolean;
  session: ReplaySession;
  sessions: SessionWindows;
  tz: string;
  onClose: () => void;
  onSave: (record: JournalRecord) => void;
}) {
  const trade = session.trade;
  const [result, setResult] = useState<TradeResult>("win");
  const [exit, setExit] = useState<string>(trade ? String(trade.takeProfit) : "");
  const [mistakes, setMistakes] = useState("");
  const [notes, setNotes] = useState("");
  if (!trade) return null;

  const exitPrice = Number(exit || 0);
  const resultR = result === "breakeven" ? 0 : resultRAt(trade, exitPrice);

  const pick = (r: TradeResult) => {
    setResult(r);
    if (r === "win") setExit(String(trade.takeProfit));
    else if (r === "loss") setExit(String(trade.stopLoss));
    else setExit(String(trade.entry));
  };

  return (
    <Sheet open={open} title="Record outcome" onClose={onClose}>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          {(["win", "loss", "breakeven"] as TradeResult[]).map((r) => (
            <button key={r} type="button" className="chip justify-center" data-active={result === r} onClick={() => pick(r)}>
              {r === "breakeven" ? "BE" : r === "win" ? "Win" : "Loss"}
            </button>
          ))}
        </div>
        <Field label="Exit price">
          <input className="panel-input num" type="number" step="0.1" value={exit} onChange={(e) => setExit(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface p-2 text-center">
          <Stat label="R:R planned" value={rrRatio(trade).toFixed(2)} />
          <Stat label="Result R" value={resultR.toFixed(2)} />
          <Stat label="Direction" value={trade.direction} />
        </div>
        <Field label="Mistakes">
          <textarea className="panel-input min-h-16" value={mistakes} onChange={(e) => setMistakes(e.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea className="panel-input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button
          type="button"
          className="touch-btn w-full font-semibold"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={() =>
            onSave({
              id: uid(),
              kind: "trade",
              sessionId: session.id,
              symbol: session.symbol,
              timeframe: session.timeframe,
              decisionTime: session.currentTime,
              session: SESSION_LABEL[sessionAt(session.currentTime, sessions, tz)],
              analysis: session.analysis,
              trade: {
                ...trade,
                status: "closed",
                closedAt: session.currentTime,
                result,
                exitPrice,
                resultR,
              },
              mistakes,
              notes,
              drawings: session.drawings,
              createdAt: Date.now(),
            })
          }
        >
          Save to journal
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- no trade ---------- */

export function NoTradeSheet({
  open,
  session,
  sessions,
  tz,
  onClose,
  onSave,
}: {
  open: boolean;
  session: ReplaySession;
  sessions: SessionWindows;
  tz: string;
  onClose: () => void;
  onSave: (record: JournalRecord) => void;
}) {
  const [reason, setReason] = useState<NoTradeReason>("no_setup");
  const [notes, setNotes] = useState("");
  return (
    <Sheet open={open} title="Record a no-trade decision" onClose={onClose}>
      <div className="space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Staying out is a decision too. Recording it keeps your review honest.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {NO_TRADE_REASONS.map((r) => (
            <button key={r.id} type="button" className="chip" data-active={reason === r.id} onClick={() => setReason(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <Field label="Notes">
          <textarea className="panel-input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button
          type="button"
          className="touch-btn w-full font-semibold"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          onClick={() =>
            onSave({
              id: uid(),
              kind: "no_trade",
              sessionId: session.id,
              symbol: session.symbol,
              timeframe: session.timeframe,
              decisionTime: session.currentTime,
              session: SESSION_LABEL[sessionAt(session.currentTime, sessions, tz)],
              analysis: session.analysis,
              trade: null,
              noTradeReason: reason,
              mistakes: "",
              notes,
              drawings: session.drawings,
              createdAt: Date.now(),
            })
          }
        >
          Save to journal
        </button>
      </div>
    </Sheet>
  );
}
