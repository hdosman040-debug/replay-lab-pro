/** Convert an overlay's fractional bar index to chart pixels. */
export function logicalToX(
  logical: number,
  coordinateAt: (index: number) => number | null,
): number | null {
  if (!Number.isFinite(logical)) return null;
  const left = Math.floor(logical);
  const leftX = coordinateAt(left);
  if (leftX === null || logical === left) return leftX;

  // The chart accepts integer indexes only. Interpolate pixel coordinates
  // ourselves for session boundaries in gaps and drawings between candles.
  const rightX = coordinateAt(left + 1);
  if (rightX === null) return null;
  return leftX + (rightX - leftX) * (logical - left);
}
