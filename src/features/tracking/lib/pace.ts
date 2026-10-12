import { haversine } from './geo';
import { type TrackPoint } from './types';

/** ms per metre is numerically seconds per kilometre. */
export function paceSecPerKm(distanceM: number, durationMs: number): number | null {
  if (distanceM <= 0 || durationMs <= 0) return null;
  return durationMs / distanceM;
}

/**
 * Current pace over a trailing time window rather than between the last two
 * fixes. One-second GPS pace swings by a minute per km on a steady run; thirty
 * seconds of track is what watches use and what feels "live" without jitter.
 * Only the current segment counts, so the first seconds after a pause do not
 * average in the stop.
 */
export function rollingPace(
  points: readonly TrackPoint[],
  windowMs = 30_000,
  minDistanceM = 20,
): number | null {
  const last = points[points.length - 1];
  if (!last) return null;
  let distance = 0;
  let start = last;
  for (let i = points.length - 1; i > 0; i--) {
    const b = points[i]!;
    const a = points[i - 1]!;
    if (a.segment !== last.segment || last.t - a.t > windowMs) break;
    distance += haversine(a, b);
    start = a;
  }
  if (distance < minDistanceM) return null;
  return paceSecPerKm(distance, last.t - start.t);
}

export type PaceSample = { distanceM: number; paceSecPerKm: number };

/**
 * Pace against distance for the chart: resampled into fixed-distance buckets
 * (so a stop does not produce a spike), then smoothed with a centred moving
 * average. Buckets that straddle a pause only count their moving part.
 */
export function paceSeries(
  points: readonly TrackPoint[],
  bucketM = 100,
  smoothing = 2,
): PaceSample[] {
  const raw: PaceSample[] = [];
  let travelled = 0;
  let bucketDistance = 0;
  let bucketDuration = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment !== b.segment) continue;
    bucketDistance += haversine(a, b);
    bucketDuration += b.t - a.t;
    if (bucketDistance >= bucketM) {
      travelled += bucketDistance;
      raw.push({ distanceM: travelled, paceSecPerKm: bucketDuration / bucketDistance });
      bucketDistance = 0;
      bucketDuration = 0;
    }
  }

  return raw.map((sample, i) => {
    const from = Math.max(0, i - smoothing);
    const to = Math.min(raw.length - 1, i + smoothing);
    let sum = 0;
    for (let j = from; j <= to; j++) sum += raw[j]!.paceSecPerKm;
    return { distanceM: sample.distanceM, paceSecPerKm: sum / (to - from + 1) };
  });
}
