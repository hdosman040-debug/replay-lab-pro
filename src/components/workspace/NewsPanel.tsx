import { useMemo, useState, type ChangeEvent } from "react";

import { ALERT_LEAD_SECONDS, parseCalendarCsv, saveNewsEvents, type NewsEvent } from "@/lib/news/calendar";
import { fmtDate, fmtDateISO, fmtTime } from "@/lib/time/ny";

export function NewsPanel({
  events,
  currentTime,
  tz,
  onLoaded,
}: {
  events: NewsEvent[];
  currentTime: number;
  tz: string;
  onLoaded: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const dayKey = fmtDateISO(currentTime, tz);

  const dayEvents = useMemo(
    () => events.filter((e) => (e.utc !== null ? fmtDateISO(e.utc, tz) : e.dateNy) === dayKey),
    [events, tz, dayKey],
  );

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const high = parseCalendarCsv(await file.text());
      if (high.length === 0) throw new Error("No High Impact events found in this file.");
      saveNewsEvents(high);
      setError(null);
      onLoaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the file.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">High-impact USD news</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {fmtDate(currentTime, tz)} · {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
          </div>
        </div>
        <label className="chip shrink-0 cursor-pointer">
          Load CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
      </div>

      {error && (
        <p className="text-xs" style={{ color: "var(--bear)" }}>
          {error}
        </p>
      )}

      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No calendar loaded. Tap Load CSV and choose replay_lab_economic_calendar.csv.
        </p>
      ) : dayEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No high-impact USD news on this day.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {dayEvents.map((e, i) => {
            const timed = e.utc !== null;
            const passed = timed && currentTime >= e.utc!;
            const soon = timed && !passed && currentTime >= e.utc! - ALERT_LEAD_SECONDS;
            const showActual = passed;
            return (
              <li
                key={`${i}-${e.utc}-${e.event}`}
                className="rounded border border-border px-2 py-1.5"
                style={{
                  opacity: passed ? 0.6 : 1,
                  borderColor: soon ? "var(--bear)" : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-xs font-semibold">{timed ? fmtTime(e.utc!, tz) : "All day"}</span>
                  {soon && (
                    <span className="text-[10px] font-semibold" style={{ color: "var(--bear)" }}>
                      NEXT {ALERT_LEAD_SECONDS / 60} MIN
                    </span>
                  )}
                </div>
                <div className="text-sm">{e.event}</div>
                <div className="num text-[11px] text-muted-foreground">
                  Fcst {e.forecast ?? "—"} · Prev {e.previous ?? "—"}
                  {showActual ? ` · Actual ${e.actual ?? "—"}` : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NewsBanner({
  alerts,
  currentTime,
  tz,
  onDismiss,
}: {
  alerts: NewsEvent[];
  currentTime: number;
  tz: string;
  onDismiss: (e: NewsEvent) => void;
}) {
  const live = alerts.filter((e) => e.utc !== null && e.utc > currentTime);
  if (live.length === 0) return null;
  return (
    <div
      data-no-snap
      className="absolute left-2 right-14 top-2 z-40 flex flex-col gap-1"
      style={{ pointerEvents: "auto" }}
    >
      {live.map((e, i) => {
        const mins = Math.max(0, Math.round((e.utc! - currentTime) / 60));
        return (
          <div
            key={`${i}-${e.utc}-${e.event}`}
            className="flex items-center gap-2 rounded border border-border bg-surface/95 px-2 py-1.5 text-xs shadow"
          >
            <span className="shrink-0 font-semibold" style={{ color: "var(--bear)" }}>
              HIGH
            </span>
            <span className="min-w-0 flex-1 truncate">
              {fmtTime(e.utc!, tz)} · {e.event} · in {mins} min
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => onDismiss(e)}
              className="shrink-0 px-1 text-base leading-none"
              style={{ color: "var(--foreground)" }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
