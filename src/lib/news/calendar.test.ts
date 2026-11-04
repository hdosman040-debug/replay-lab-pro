import { describe, expect, it } from "vitest";
import { mergeNewsEvents, parseCalendarCsv, type NewsEvent } from "./calendar";

const event = (overrides: Partial<NewsEvent>): NewsEvent => ({
  utc: 1_700_000_000,
  dateNy: "2023-11-14",
  event: "CPI",
  impact: "High Impact Expected",
  actual: null,
  forecast: "3.2%",
  previous: "3.7%",
  ...overrides,
});

describe("news event merging", () => {
  it("preserves unique events and lets later data update duplicates", () => {
    const local = [
      event({ forecast: "old forecast" }),
      event({
        utc: 1_700_003_600,
        event: "Retail Sales",
      }),
    ];

    const remote = [
      event({ forecast: "new forecast" }),
      event({
        utc: 1_700_007_200,
        event: "FOMC",
      }),
    ];

    const merged = mergeNewsEvents(local, remote);

    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.event === "CPI")?.forecast).toBe(
      "new forecast",
    );
    expect(merged.some((item) => item.event === "Retail Sales")).toBe(true);
    expect(merged.some((item) => item.event === "FOMC")).toBe(true);
  });
  it("normalizes CSV headers and impact whitespace", () => {
    const csv = `\ufeff date_ny , datetime_utc , event , impact , actual , forecast , previous
2024-01-02 , 2024-01-02T13:30:00Z , CPI , High Impact Expected , , 3.2% , 3.7%
`;

    const parsed = parseCalendarCsv(csv);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      dateNy: "2024-01-02",
      event: "CPI",
      impact: "High Impact Expected",
      forecast: "3.2%",
    });
  });

});
