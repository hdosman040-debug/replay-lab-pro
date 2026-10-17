import type { PricePoint } from "./types";

export function ownsGesture(
  activePointerId: number | null,
  eventPointerId: number,
): boolean {
  return activePointerId !== null && activePointerId === eventPointerId;
}

export function drawingPointsChanged(
  before: readonly PricePoint[],
  after: readonly PricePoint[],
): boolean {
  return (
    before.length !== after.length ||
    before.some((point, index) => {
      const next = after[index];
      return (
        !next ||
        point.time !== next.time ||
        point.price !== next.price
      );
    })
  );
}
