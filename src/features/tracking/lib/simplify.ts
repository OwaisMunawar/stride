import { metresPerDegree } from './geo';
import { type LatLon } from './types';

/**
 * Ramer-Douglas-Peucker in local metres. Used to shrink a 1 Hz track to the
 * few dozen vertices a 56 pt thumbnail can show, and to keep the live map's
 * GeoJSON small enough to re-send every second.
 *
 * Iterative with an explicit stack: a two-hour ride is 7,000 points, which
 * is too deep for recursion on some JS engines.
 */
export function simplify<T extends LatLon>(points: readonly T[], toleranceM: number): T[] {
  if (points.length <= 2) return [...points];
  const scale = metresPerDegree(points[0]!.lat);
  const xy = points.map((p) => ({ x: p.lon * scale.lon, y: p.lat * scale.lat }));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(xy[i]!, xy[first]!, xy[last]!);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > toleranceM) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

type XY = { x: number; y: number };

function perpendicularDistance(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
