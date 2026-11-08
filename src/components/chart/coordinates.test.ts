import { describe, expect, it, vi } from "vitest";
import { logicalToX } from "./coordinates";

// Lightweight Charts 5.2 returns 0 for a non-integer logical index.
// Our time interpolation produces those indexes at market gaps and between bars.
const chartCoordinate = (index: number): number | null =>
  Number.isInteger(index) ? 100 + index * 6 : 0;

describe("overlay coordinates between chart bars", () => {
  it("keeps exact candle coordinates", () => {
    expect(logicalToX(8, chartCoordinate)).toBe(148);
  });

  it("places an H1 session start at 09:30 between the 09:00 and 10:00 bars", () => {
    expect(logicalToX(8.5, chartCoordinate)).toBe(151);
  });

  it.each([
    ["M5", 5 * 60],
    ["M30", 30 * 60],
  ])("keeps the %s New York end after its start when 16:00 falls in a market break", (_tf, barSeconds) => {
    // Last bar before 16:00, then the next available bar at 19:30.
    const fraction = barSeconds / (3.5 * 3600 + barSeconds);
    const endLogical = 20 + fraction;
    const startX = logicalToX(10, chartCoordinate)!;
    const endX = logicalToX(endLogical, chartCoordinate)!;
    expect(endX).toBeGreaterThan(startX);
    expect(endX).toBeGreaterThan(chartCoordinate(20)!);
    expect(endX).toBeLessThan(chartCoordinate(21)!);
  });

  it("supports positions before and after the loaded candles", () => {
    expect(logicalToX(-1.5, chartCoordinate)).toBe(91);
    expect(logicalToX(100.25, chartCoordinate)).toBe(701.5);
  });

  it("returns null when the chart has no coordinates", () => {
    expect(logicalToX(0.5, () => null)).toBeNull();
    expect(logicalToX(0.5, (index) => index === 0 ? 100 : null)).toBeNull();
  });

  it("does not call the chart with non-finite indexes", () => {
    const coordinateAt = vi.fn(chartCoordinate);
    expect(logicalToX(Number.NaN, coordinateAt)).toBeNull();
    expect(logicalToX(Infinity, coordinateAt)).toBeNull();
    expect(coordinateAt).not.toHaveBeenCalled();
  });
});
