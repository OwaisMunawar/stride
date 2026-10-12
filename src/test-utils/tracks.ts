import { gaussian, seededRandom } from '@/features/demo/lib/random';
import { haversine, offset } from '@/features/tracking/lib/geo';
import { type Fix, type LatLon, type TrackPoint } from '@/features/tracking/lib/types';

export const ORIGIN: LatLon = { lat: 37.8044, lon: -122.4594 };

/**
 * A synthetic straight track at constant speed, one fix per `intervalMs`.
 * Bearing in degrees clockwise from north. Optional jitter is seeded and
 * correlated over time (AR(1), like real multipath drift) with roughly
 * `jitterM` standard deviation per axis.
 */
export function straightFixes(options: {
  start?: LatLon;
  startT?: number;
  speedMps: number;
  seconds: number;
  bearingDeg?: number;
  intervalMs?: number;
  accuracy?: number | null;
  withSpeed?: boolean;
  jitterM?: number;
  alt?: (i: number) => number | null;
}): Fix[] {
  const {
    start = ORIGIN,
    startT = 1_700_000_000_000,
    speedMps,
    seconds,
    bearingDeg = 90,
    intervalMs = 1000,
    accuracy = 5,
    withSpeed = true,
    jitterM = 0,
    alt = () => 10,
  } = options;
  const rad = (bearingDeg * Math.PI) / 180;
  const count = Math.floor((seconds * 1000) / intervalMs) + 1;
  const random = seededRandom(42);
  // Innovation scale so the AR(1) process has the requested standard deviation.
  const innovation = jitterM * Math.sqrt(1 - 0.9 * 0.9);
  let jitterE = 0;
  let jitterN = 0;
  return Array.from({ length: count }, (_, i) => {
    const d = speedMps * ((i * intervalMs) / 1000);
    jitterE = jitterE * 0.9 + gaussian(random) * innovation;
    jitterN = jitterN * 0.9 + gaussian(random) * innovation;
    const p = offset(start, Math.sin(rad) * d + jitterE, Math.cos(rad) * d + jitterN);
    return {
      t: startT + i * intervalMs,
      lat: p.lat,
      lon: p.lon,
      alt: alt(i),
      accuracy,
      altitudeAccuracy: accuracy,
      speed: withSpeed ? speedMps : null,
    };
  });
}

/** Stationary fixes at a point, for auto-pause tests. */
export function stationaryFixes(at: LatLon, startT: number, seconds: number, jitterM = 0): Fix[] {
  return straightFixes({ start: at, startT, speedMps: 0, seconds, jitterM, withSpeed: true }).map(
    (f) => ({ ...f, speed: 0 }),
  );
}

export function toPoints(fixes: readonly Fix[], segment = 0): TrackPoint[] {
  return fixes.map((f) => ({ t: f.t, lat: f.lat, lon: f.lon, alt: f.alt, segment }));
}

export function pathLength(points: readonly LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1]!, points[i]!);
  return total;
}
