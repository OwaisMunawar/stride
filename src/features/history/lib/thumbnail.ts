import { boundsOf, haversine, metresPerDegree } from '@/features/tracking/lib/geo';
import { simplify } from '@/features/tracking/lib/simplify';
import { type LatLon, type TrackPoint } from '@/features/tracking/lib/types';

/** Simplified route, one polyline per segment, as [lat, lon] rounded to ~1 m. */
export type Thumbnail = [number, number][][];

const round = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * Stored with the run so the history list never loads full tracks. Tolerance
 * scales with the route's size: a 56 pt thumbnail of a 40 km ride cannot show
 * detail finer than ~150 m anyway.
 */
export function buildThumbnail(points: readonly TrackPoint[], targetPx = 112): Thumbnail {
  const bounds = boundsOf(points);
  if (!bounds) return [];
  const diagonal = haversine(
    { lat: bounds.minLat, lon: bounds.minLon },
    { lat: bounds.maxLat, lon: bounds.maxLon },
  );
  const tolerance = Math.max(2, diagonal / targetPx);

  const segments = new Map<number, TrackPoint[]>();
  for (const point of points) {
    const list = segments.get(point.segment) ?? [];
    list.push(point);
    segments.set(point.segment, list);
  }
  return [...segments.values()]
    .map((segment) =>
      simplify(segment, tolerance).map((p): [number, number] => [round(p.lat), round(p.lon)]),
    )
    .filter((line) => line.length >= 2);
}

/**
 * Projects lat/lon polylines into a pixel box, preserving aspect ratio and
 * centring the route. North is up; x grows east.
 */
export function projectToBox(
  lines: readonly (readonly LatLon[])[],
  width: number,
  height: number,
  padding: number,
): { x: number; y: number }[][] {
  const all = lines.flat();
  const bounds = boundsOf(all);
  if (!bounds) return [];
  const scale = metresPerDegree((bounds.minLat + bounds.maxLat) / 2);
  const spanX = Math.max(1, (bounds.maxLon - bounds.minLon) * scale.lon);
  const spanY = Math.max(1, (bounds.maxLat - bounds.minLat) * scale.lat);
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const k = Math.min(innerW / spanX, innerH / spanY);
  const offsetX = padding + (innerW - spanX * k) / 2;
  const offsetY = padding + (innerH - spanY * k) / 2;

  return lines.map((line) =>
    line.map((p) => ({
      x: offsetX + (p.lon - bounds.minLon) * scale.lon * k,
      y: offsetY + (bounds.maxLat - p.lat) * scale.lat * k,
    })),
  );
}

export function thumbnailToLatLon(thumbnail: Thumbnail): LatLon[][] {
  return thumbnail.map((line) => line.map(([lat, lon]) => ({ lat, lon })));
}
