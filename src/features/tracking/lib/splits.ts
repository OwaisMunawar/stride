import { haversine, lerp } from './geo';
import { type Split, type TrackPoint } from './types';

/** A trailing partial split shorter than this is noise from stopping the watch. */
const MIN_PARTIAL_M = 50;

/**
 * Splits by unit length (1000 m or one mile), timed on moving time only: time
 * between segments (pauses) is never counted, and the boundary crossing inside
 * a pair of points is interpolated linearly in both time and elevation.
 */
export function computeSplits(points: readonly TrackPoint[], unitM: number): Split[] {
  const splits: Split[] = [];
  let splitDistance = 0;
  let splitDuration = 0;
  let splitStartAlt: number | null = points[0]?.alt ?? null;

  const push = (distanceM: number, durationMs: number, endAlt: number | null, partial: boolean) => {
    splits.push({
      index: splits.length + 1,
      distanceM,
      durationMs,
      paceSecPerKm: distanceM > 0 ? durationMs / distanceM : 0,
      elevationDeltaM: endAlt !== null && splitStartAlt !== null ? endAlt - splitStartAlt : 0,
      partial,
    });
  };

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment !== b.segment) continue;

    let remainingDistance = haversine(a, b);
    let remainingDuration = b.t - a.t;
    let fromAlt = a.alt;

    while (splitDistance + remainingDistance >= unitM && remainingDistance > 0) {
      const needed = unitM - splitDistance;
      const fraction = needed / remainingDistance;
      const crossingAlt =
        fromAlt !== null && b.alt !== null ? lerp(fromAlt, b.alt, fraction) : null;
      push(unitM, splitDuration + remainingDuration * fraction, crossingAlt, false);

      remainingDuration -= remainingDuration * fraction;
      remainingDistance -= needed;
      fromAlt = crossingAlt;
      splitStartAlt = crossingAlt ?? splitStartAlt;
      splitDistance = 0;
      splitDuration = 0;
    }
    splitDistance += remainingDistance;
    splitDuration += remainingDuration;
  }

  if (splitDistance >= MIN_PARTIAL_M) {
    push(splitDistance, splitDuration, points[points.length - 1]?.alt ?? null, true);
  }
  return splits;
}

/** Moving time: the sum of intervals inside segments. Gaps between segments are pauses. */
export function movingTimeMs(points: readonly TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment === b.segment) total += b.t - a.t;
  }
  return total;
}

export function trackDistance(points: readonly TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment === b.segment) total += haversine(a, b);
  }
  return total;
}
