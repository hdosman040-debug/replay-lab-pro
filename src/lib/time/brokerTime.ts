import { zonedToUtc } from "./ny";

/**
 * US30 CSV clock = New York wall clock + N hours.
 * Found from the daily 17:00 New York market break: the last candle before it is
 * always 16:58 New York. The switch days are read from the data, not from a DST rule.
 */
const SWITCHES: Array<{ from: string; hours: number }> = [
  { from: "2016-01-01", hours: 6 },
  { from: "2024-11-04", hours: 7 },
  { from: "2025-03-10", hours: 6 },
  { from: "2025-03-31", hours: 7 },
];

export function brokerHoursAhead(dayKey: string): number {
  let hours = SWITCHES[0].hours;
  for (const s of SWITCHES) {
    if (dayKey >= s.from) hours = s.hours;
  }
  return hours;
}

/**
 * wall: the CSV timestamp read as if it were UTC (seconds).
 * dayKey: the CSV calendar day, YYYY-MM-DD.
 * Returns the real UTC seconds of that candle.
 */
export function brokerWallToUtc(wall: number, dayKey: string): number {
  const ny = new Date((wall - brokerHoursAhead(dayKey) * 3600) * 1000);
  return zonedToUtc(
    ny.getUTCFullYear(),
    ny.getUTCMonth() + 1,
    ny.getUTCDate(),
    ny.getUTCHours(),
    ny.getUTCMinutes(),
  );
}
