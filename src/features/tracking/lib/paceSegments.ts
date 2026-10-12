import { haversine } from './geo';
import { type TrackPoint } from './types';

export type PaceSegment = {
  /** [lon, lat] pairs, GeoJSON order. */
  coordinates: [number, number][];
  /** 0 (slowest) to levels-1 (fastest). */
  level: number;
};

/**
 * Splits the route into short stretches coloured by relative pace. Levels are
 * relative to this run (10th to 90th percentile), not absolute, so an easy run
 * and a race both use the whole ramp; that is what makes surges visible.
 * Adjacent stretches at the same level are merged to keep the GeoJSON small.
 */
export function paceSegments(
  points: readonly TrackPoint[],
  levels: number,
  stretchM = 200,
): PaceSegment[] {
  type Stretch = { coords: [number, number][]; pace: number };
  const stretches: Stretch[] = [];
  let current: Stretch | null = null;
  let distance = 0;
  let duration = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment !== b.segment) {
      current = null;
      distance = 0;
      duration = 0;
      continue;
    }
    if (!current) {
      current = { coords: [[a.lon, a.lat]], pace: 0 };
      stretches.push(current);
    }
    current.coords.push([b.lon, b.lat]);
    distance += haversine(a, b);
    duration += b.t - a.t;
    current.pace = distance > 0 ? duration / distance : 0;
    if (distance >= stretchM) {
      current = { coords: [[b.lon, b.lat]], pace: 0 };
      stretches.push(current);
      distance = 0;
      duration = 0;
    }
  }

  const usable = stretches.filter((s) => s.coords.length >= 2);
  const paces = usable
    .map((s) => s.pace)
    .filter((p) => p > 0)
    .sort((x, y) => x - y);
  if (paces.length === 0) return [];
  const fast = quantile(paces, 0.1);
  const slow = quantile(paces, 0.9);

  const merged: PaceSegment[] = [];
  for (const stretch of usable) {
    const level = levelFor(stretch.pace, fast, slow, levels);
    const previous = merged[merged.length - 1];
    const joins =
      previous &&
      previous.level === level &&
      sameCoord(previous.coordinates[previous.coordinates.length - 1], stretch.coords[0]);
    if (joins) previous.coordinates.push(...stretch.coords.slice(1));
    else merged.push({ coordinates: stretch.coords, level });
  }
  return merged;
}

/** Below this spread a run is "even" and drawn in one colour, not stretched to a rainbow. */
const MIN_RELATIVE_SPREAD = 0.04;

function levelFor(pace: number, fast: number, slow: number, levels: number): number {
  if (pace <= 0 || (slow - fast) / fast < MIN_RELATIVE_SPREAD) return Math.floor(levels / 2);
  const speedRank = (slow - pace) / (slow - fast);
  return Math.max(0, Math.min(levels - 1, Math.round(speedRank * (levels - 1))));
}

function quantile(sorted: readonly number[], q: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[index]!;
}

function sameCoord(a: [number, number] | undefined, b: [number, number] | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}
