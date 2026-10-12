import { type Bounds, type LatLon } from './types';

/** IUGG mean Earth radius. The spherical error is under 0.5%, far below GPS noise. */
export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Metres per degree at a latitude, for an equirectangular projection. Over the
 * few kilometres of a run this is accurate to centimetres, and it lets filters
 * and simplification work in plain Cartesian metres.
 */
export function metresPerDegree(lat: number): { lat: number; lon: number } {
  const perDegree = (Math.PI / 180) * EARTH_RADIUS_M;
  return { lat: perDegree, lon: perDegree * Math.cos(toRad(lat)) };
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

export function boundsOf(points: readonly LatLon[]): Bounds | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}

/** Moves a point by metres east and north. Used by the demo route generator and tests. */
export function offset(origin: LatLon, eastM: number, northM: number): LatLon {
  const scale = metresPerDegree(origin.lat);
  return { lat: origin.lat + northM / scale.lat, lon: origin.lon + eastM / scale.lon };
}
