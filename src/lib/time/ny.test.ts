import { describe, expect, it } from "vitest";
import { DEFAULT_SESSIONS, sessionAt, zonedParts, zonedToUtc } from "./ny";

const utc = (y: number, mo: number, d: number, h: number, mi = 0) =>
  Date.UTC(y, mo - 1, d, h, mi) / 1000;

describe("zonedParts", () => {
  it("reads PM as 24h", () => {
    expect(zonedParts(utc(2024, 1, 2, 20)).hour).toBe(15);
  });
  it("reads midnight as 0", () => {
    expect(zonedParts(utc(2024, 1, 2, 5)).hour).toBe(0);
  });
  it("round-trips", () => {
    for (const [h, m] of [[0, 0], [9, 30], [13, 0], [15, 30], [23, 0]]) {
      const p = zonedParts(zonedToUtc(2024, 1, 2, h!, m!));
      expect([p.hour, p.minute]).toEqual([h, m]);
    }
  });
  it("handles DST", () => {
    expect(zonedToUtc(2024, 7, 1, 15, 0)).toBe(utc(2024, 7, 1, 19));
  });
});

describe("sessionAt", () => {
  it("labels PM correctly", () => {
    const at = (h: number, m: number) => sessionAt(zonedToUtc(2024, 1, 2, h, m), DEFAULT_SESSIONS);
    expect(at(14, 0)).toBe("newyork");
    expect(at(15, 30)).toBe("newyork");
    expect(at(16, 0)).toBe("off");
    expect(at(23, 0)).toBe("asia");
    expect(at(4, 0)).toBe("london");
  });
});
