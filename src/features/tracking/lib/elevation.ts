import { haversine } from './geo';
import { type TrackPoint } from './types';

/**
 * Centred moving average over the altitudes that exist. GPS altitude is the
 * noisiest axis (often ±10 m), and summing raw deltas on a flat loop invents
 * hundreds of metres of climbing.
 */
export function smoothAltitudes(
  altitudes: readonly (number | null)[],
  radius = 15,
): (number | null)[] {
  return altitudes.map((alt, i) => {
    if (alt === null) return null;
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(altitudes.length - 1, i + radius); j++) {
      const value = altitudes[j];
      if (value !== null && value !== undefined) {
        sum += value;
        count++;
      }
    }
    return sum / count;
  });
}

/**
 * Gain and loss with a dead band: climbing is only counted once the smoothed
 * altitude has moved `thresholdM` away from the last anchor. Small oscillations
 * inside the band cancel out instead of accumulating.
 */
export function elevationChange(
  points: readonly TrackPoint[],
  thresholdM = 4,
): { gainM: number; lossM: number } {
  const smoothed = smoothAltitudes(points.map((p) => p.alt));
  let anchor: number | null = null;
  let gainM = 0;
  let lossM = 0;
  for (const alt of smoothed) {
    if (alt === null) continue;
    if (anchor === null) {
      anchor = alt;
      continue;
    }
    const delta = alt - anchor;
    if (delta >= thresholdM) {
      gainM += delta;
      anchor = alt;
    } else if (delta <= -thresholdM) {
      lossM -= delta;
      anchor = alt;
    }
  }
  return { gainM, lossM };
}

export type ElevationSample = { distanceM: number; altitudeM: number };

/** Smoothed altitude against cumulative distance, for the elevation chart. */
export function elevationProfile(points: readonly TrackPoint[]): ElevationSample[] {
  const smoothed = smoothAltitudes(points.map((p) => p.alt));
  const profile: ElevationSample[] = [];
  let distance = 0;
  points.forEach((point, i) => {
    const previous = points[i - 1];
    if (previous && previous.segment === point.segment) distance += haversine(previous, point);
    const alt = smoothed[i];
    if (alt !== null && alt !== undefined) profile.push({ distanceM: distance, altitudeM: alt });
  });
  return profile;
}
