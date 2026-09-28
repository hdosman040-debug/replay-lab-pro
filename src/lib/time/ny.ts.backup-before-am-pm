/**
 * Session-timezone helpers. All stored timestamps are UTC seconds; the
 * session timezone (default America/New_York) is only used for display and
 * session calculations. Never depends on the device timezone.
 */

export const DEFAULT_TZ = "America/New_York";

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string, opts: Intl.DateTimeFormatOptions) {
  const key = tz + JSON.stringify(opts);
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts });
    dtfCache.set(key, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(utcSeconds: number, tz = DEFAULT_TZ): ZonedParts {
  const parts = dtf(tz, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(utcSeconds * 1000));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return {
    year: +get("year"),
    month: +get("month"),
    day: +get("day"),
    hour: +get("hour") % 24,
    minute: +get("minute"),
    second: +get("second"),
    weekday: Math.max(0, WD.indexOf(get("weekday"))),
  };
}

/** Offset (seconds) of tz from UTC at the given instant. */
export function tzOffsetSeconds(utcSeconds: number, tz = DEFAULT_TZ): number {
  const p = zonedParts(utcSeconds, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000;
  return asUtc - utcSeconds;
}

/** Convert a wall-clock time in tz to UTC seconds. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz = DEFAULT_TZ,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute) / 1000;
  const off1 = tzOffsetSeconds(guess, tz);
  const t1 = guess - off1;
  const off2 = tzOffsetSeconds(t1, tz);
  return guess - off2;
}

export function minutesOfDay(utcSeconds: number, tz = DEFAULT_TZ): number {
  const p = zonedParts(utcSeconds, tz);
  return p.hour * 60 + p.minute;
}

export function fmtTime(utcSeconds: number, tz = DEFAULT_TZ): string {
  return dtf(tz, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(utcSeconds * 1000));
}

export function fmtDate(utcSeconds: number, tz = DEFAULT_TZ): string {
  return dtf(tz, { year: "numeric", month: "short", day: "2-digit", weekday: "short" }).format(
    new Date(utcSeconds * 1000),
  );
}

export function fmtDateTime(utcSeconds: number, tz = DEFAULT_TZ): string {
  return `${fmtDate(utcSeconds, tz)} ${fmtTime(utcSeconds, tz)}`;
}

export function fmtDateISO(utcSeconds: number, tz = DEFAULT_TZ): string {
  const p = zonedParts(utcSeconds, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function fmtTimeISO(utcSeconds: number, tz = DEFAULT_TZ): string {
  const p = zonedParts(utcSeconds, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export type SessionName = "asia" | "london" | "newyork" | "off";

export interface SessionWindows {
  asia: [string, string];
  london: [string, string];
  newyork: [string, string];
  tradingWindow: [string, string];
}

export const DEFAULT_SESSIONS: SessionWindows = {
  asia: ["19:00", "02:00"],
  london: ["02:00", "08:00"],
  newyork: ["08:00", "16:00"],
  tradingWindow: ["09:45", "12:00"],
};

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function inWindow(minute: number, [a, b]: [string, string]): boolean {
  const s = hhmmToMinutes(a);
  const e = hhmmToMinutes(b);
  if (s <= e) return minute >= s && minute < e;
  return minute >= s || minute < e; // wraps midnight
}

export function sessionAt(utcSeconds: number, windows: SessionWindows, tz = DEFAULT_TZ): SessionName {
  const m = minutesOfDay(utcSeconds, tz);
  if (inWindow(m, windows.newyork)) return "newyork";
  if (inWindow(m, windows.london)) return "london";
  if (inWindow(m, windows.asia)) return "asia";
  return "off";
}

export const SESSION_LABEL: Record<SessionName, string> = {
  asia: "Asia",
  london: "London",
  newyork: "New York",
  off: "Off-hours",
};
