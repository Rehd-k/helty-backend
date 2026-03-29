export interface ComparisonDelta {
  percentChange: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** Percent change from previous to current; 100% when previous is 0 and current > 0. */
export function compareMetrics(
  current: number,
  previous: number,
): ComparisonDelta {
  if (previous === 0) {
    if (current === 0) {
      return { percentChange: 0, direction: 'flat' };
    }
    return { percentChange: 100, direction: 'up' };
  }
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw * 100) / 100;
  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (current > previous) direction = 'up';
  else if (current < previous) direction = 'down';
  return { percentChange: rounded, direction };
}
