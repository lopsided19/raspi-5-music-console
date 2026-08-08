export function edgeHitAtX({ start, end, startHitStart, startHitEnd, endHitStart, endHitEnd }, x) {
  const inside = x >= start && x <= end;
  if (inside) {
    const inStart = x <= Math.min(end, startHitEnd);
    const inEnd = x >= Math.max(start, endHitStart);
    if (inStart && inEnd) return x - start <= end - x ? "start" : "end";
    if (inStart) return "start";
    if (inEnd) return "end";
    return null;
  }
  if (x < start && x >= startHitStart) return "start";
  if (x > end && x <= endHitEnd) return "end";
  return null;
}

export function interiorRangeAtX(ranges, x) {
  return ranges.find(({ start, end }) => x > start && x < end)
    ?? ranges.find(({ start, end }) => x >= start && x <= end)
    ?? null;
}
