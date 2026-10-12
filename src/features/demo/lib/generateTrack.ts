import { haversine, lerp, offset } from '@/features/tracking/lib/geo';
import { type Fix, type LatLon } from '@/features/tracking/lib/types';

import { gaussian, type Random } from './random';
import { type DemoRoute } from './routes';

export type TrackPlan = {
  route: DemoRoute;
  startedAt: number;
  distanceM: number;
  /** Average moving pace for runs; rides use the equivalent speed. */
  paceSecPerKm: number;
  /** Positive slows down over the session (fade), negative speeds up (negative split). */
  trend: number;
  /** Standing still, e.g. at a crossing, so auto-pause has something to do. */
  stops?: readonly { atM: number; seconds: number }[];
  /** Include the device-reported Doppler speed, as a phone would. GPX files have none. */
  withSpeed: boolean;
};

/**
 * Synthesises a 1 Hz track along a route with the artefacts real phones
 * produce: correlated position drift (multipath does not jump independently
 * each second), reported accuracy that varies with it, altitude noise larger
 * than horizontal noise, and the occasional wild fix the outlier gate exists
 * for. Deterministic for a given random source.
 */
export function generateTrack(plan: TrackPlan, random: Random): Fix[] {
  const path = buildPath(plan.route, plan.distanceM);
  const totalM = path.length > 0 ? path[path.length - 1]!.d : 0;
  const baseSpeed = 1000 / plan.paceSecPerKm;
  const stops = [...(plan.stops ?? [])].sort((a, b) => a.atM - b.atM);

  const fixes: Fix[] = [];
  let t = plan.startedAt;
  let travelled = 0;
  let speedFactor = 1;
  let driftE = 0;
  let driftN = 0;
  let altNoise = 0;
  let stopIndex = 0;
  let pathHint = 0;
  const phase = random() * Math.PI * 2;

  const emit = (trueSpeed: number) => {
    const truePos = positionAt(path, travelled, pathHint);
    pathHint = truePos.index;
    // AR(1) drift: about 2.5 m standard deviation, decorrelating over ~10 s.
    driftE = driftE * 0.9 + gaussian(random) * 1.1;
    driftN = driftN * 0.9 + gaussian(random) * 1.1;
    altNoise = altNoise * 0.85 + gaussian(random) * 0.9;

    let position = offset(truePos.point, driftE, driftN);
    let accuracy = 4 + Math.abs(gaussian(random)) * 2.5 + Math.hypot(driftE, driftN) * 0.3;
    if (random() < 0.004) {
      // A multipath spike: tens of metres off, and the phone usually knows it is unsure.
      const bearing = random() * Math.PI * 2;
      const jump = 40 + random() * 80;
      position = offset(position, Math.cos(bearing) * jump, Math.sin(bearing) * jump);
      accuracy = random() < 0.6 ? 20 + random() * 40 : accuracy;
    }

    const relief = plan.route.reliefM;
    const altitude =
      plan.route.baseAltitudeM +
      relief * Math.sin((travelled / 1400) * Math.PI * 2 + phase) +
      relief * 0.35 * Math.sin((travelled / 380) * Math.PI * 2) +
      altNoise * 1.2;

    fixes.push({
      t: Math.round(t),
      lat: position.lat,
      lon: position.lon,
      alt: Math.round(altitude * 10) / 10,
      accuracy: Math.round(accuracy * 10) / 10,
      altitudeAccuracy: Math.round(accuracy * 1.6 * 10) / 10,
      speed: plan.withSpeed ? Math.max(0, trueSpeed + gaussian(random) * 0.15) : null,
    });
  };

  emit(0);
  while (travelled < totalM) {
    t += 1000;
    const nextStop = stops[stopIndex];
    if (nextStop && travelled >= nextStop.atM) {
      for (let s = 0; s < nextStop.seconds; s++) {
        emit(0);
        t += 1000;
      }
      stopIndex++;
    }
    speedFactor = speedFactor * 0.97 + (1 + gaussian(random) * 0.05) * 0.03;
    const progress = travelled / Math.max(1, totalM);
    const trend = 1 - plan.trend * (progress - 0.5);
    const speed = Math.max(0.5, baseSpeed * speedFactor * trend);
    travelled = Math.min(totalM, travelled + speed);
    emit(speed);
  }
  return fixes;
}

type PathPoint = { point: LatLon; d: number };

/** The route laid end to end (and back, for out-and-back) up to the target distance. */
export function buildPath(route: DemoRoute, targetM: number): PathPoint[] {
  const forward = route.waypoints;
  const backward = [...forward].reverse().slice(1);
  const loop = route.outAndBack ? [...forward, ...backward] : forward;
  const path: PathPoint[] = [];
  let d = 0;
  let previous: LatLon | null = null;
  for (let lap = 0; lap < 50 && d < targetM; lap++) {
    for (const point of lap === 0 ? loop : loop.slice(1)) {
      if (previous) {
        const step = haversine(previous, point);
        if (d + step >= targetM) {
          const f = (targetM - d) / step;
          path.push({
            point: { lat: lerp(previous.lat, point.lat, f), lon: lerp(previous.lon, point.lon, f) },
            d: targetM,
          });
          return path;
        }
        d += step;
      }
      path.push({ point, d });
      previous = point;
    }
  }
  return path;
}

function positionAt(
  path: readonly PathPoint[],
  d: number,
  hint: number,
): { point: LatLon; index: number } {
  let i = Math.max(0, Math.min(hint, path.length - 2));
  while (i < path.length - 2 && path[i + 1]!.d < d) i++;
  const a = path[i]!;
  const b = path[i + 1] ?? a;
  const span = b.d - a.d;
  const f = span > 0 ? Math.min(1, Math.max(0, (d - a.d) / span)) : 0;
  return {
    point: { lat: lerp(a.point.lat, b.point.lat, f), lon: lerp(a.point.lon, b.point.lon, f) },
    index: i,
  };
}
