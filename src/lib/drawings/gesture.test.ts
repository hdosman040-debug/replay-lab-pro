import { describe, expect, it } from "vitest";
import { drawingPointsChanged, ownsGesture } from "./gesture";

describe("drawing gesture ownership", () => {
  it("accepts the initiating pointer", () => {
    expect(ownsGesture(7, 7)).toBe(true);
  });

  it("rejects a second pointer", () => {
    expect(ownsGesture(7, 8)).toBe(false);
  });

  it("rejects pointer events after cancellation", () => {
    expect(ownsGesture(null, 7)).toBe(false);
  });
});

describe("drawing gesture commits", () => {
  const original = [
    { time: 100, price: 42000 },
    { time: 160, price: 42100 },
  ];

  it("does not commit a tap without movement", () => {
    expect(drawingPointsChanged(original, original)).toBe(false);
  });

  it("does not commit an identical copy", () => {
    expect(drawingPointsChanged(original, original.map((p) => ({ ...p })))).toBe(false);
  });

  it("commits a changed anchor position", () => {
    expect(
      drawingPointsChanged(original, [
        { time: 100, price: 42000 },
        { time: 160, price: 42150 },
      ]),
    ).toBe(true);
  });

  it("detects changes in the number of anchors", () => {
    expect(drawingPointsChanged(original, [{ time: 100, price: 42000 }])).toBe(true);
  });

  it("does not commit a drag returned to its starting position", () => {
    const returned = original.map((p) => ({ ...p }));
    expect(drawingPointsChanged(original, returned)).toBe(false);
  });
});
