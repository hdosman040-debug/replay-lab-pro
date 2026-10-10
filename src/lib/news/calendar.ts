export const NEWS_STORAGE_KEY = "ict-terminal.news.v1";
export const HIGH_IMPACT = "High Impact Expected";
export const ALERT_LEAD_SECONDS = 30 * 60;

export interface NewsEvent {
  /** unix seconds (UTC). null = all-day release with no clock time */
  utc: number | null;
  /** New York calendar date, YYYY-MM-DD (from date_ny) */
  dateNy: string;
  event: string;
  impact: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

/** Parses the replay_lab_economic_calendar CSV and keeps High Impact rows only. */
export function parseCalendarCsv(text: string): NewsEvent[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  const header = rows.shift() ?? [];
  const col = (name: string) => header.indexOf(name);
  const iDate = col("date_ny");
  const iUtc = col("datetime_utc");
  const iEvent = col("event");
  const iImpact = col("impact");
  const iActual = col("actual");
  const iForecast = col("forecast");
  const iPrevious = col("previous");

  if (iDate < 0 || iUtc < 0 || iEvent < 0 || iImpact < 0) {
    throw new Error("This file is missing one of: date_ny, datetime_utc, event, impact.");
  }

  const out: NewsEvent[] = [];
  for (const r of rows) {
    const cell = (i: number) => (i >= 0 && r[i] ? r[i]! : null);
    const iso = cell(iUtc);
    const utc = iso ? Date.parse(iso) / 1000 : NaN;
    const e: NewsEvent = {
      utc: Number.isFinite(utc) ? utc : null,
      dateNy: r[iDate] ?? "",
      event: r[iEvent] ?? "",
      impact: r[iImpact] ?? "",
      actual: cell(iActual),
      forecast: cell(iForecast),
      previous: cell(iPrevious),
    };
    if (e.impact === HIGH_IMPACT) out.push(e);
  }
  return out.sort((a, b) => a.dateNy.localeCompare(b.dateNy) || (a.utc ?? 0) - (b.utc ?? 0));
}

export function loadNewsEvents(): NewsEvent[] {
  try {
    const raw = localStorage.getItem(NEWS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NewsEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveNewsEvents(events: NewsEvent[]): void {
  localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(events));
}
