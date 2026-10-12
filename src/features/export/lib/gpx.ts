import { AppError } from '@/core/errors/AppError';
import { type ActivityType, type Fix, type TrackPoint } from '@/features/tracking/lib/types';

/**
 * GPX 1.1 (https://www.topografix.com/GPX/1/1/). One <trkseg> per track
 * segment, so pauses survive a round trip through Strava, Garmin Connect or
 * this app's own importer.
 */
export function writeGpx(input: {
  name: string;
  activity: ActivityType;
  startedAt: number;
  points: readonly TrackPoint[];
}): string {
  const segments = new Map<number, TrackPoint[]>();
  for (const point of input.points) {
    const list = segments.get(point.segment) ?? [];
    list.push(point);
    segments.set(point.segment, list);
  }

  const body = [...segments.values()]
    .map((points) => {
      const trkpts = points
        .map((p) => {
          const ele = p.alt !== null ? `<ele>${round(p.alt, 1)}</ele>` : '';
          return `      <trkpt lat="${round(p.lat, 7)}" lon="${round(p.lon, 7)}">${ele}<time>${iso(p.t)}</time></trkpt>`;
        })
        .join('\n');
      return `    <trkseg>\n${trkpts}\n    </trkseg>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Stride" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    `  <metadata><name>${escapeXml(input.name)}</name><time>${iso(input.startedAt)}</time></metadata>`,
    '  <trk>',
    `    <name>${escapeXml(input.name)}</name>`,
    `    <type>${input.activity === 'ride' ? 'cycling' : 'running'}</type>`,
    body,
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

export type ParsedGpx = {
  name: string | null;
  activity: ActivityType | null;
  /** One array per <trkseg> (or <rte>), in document order. */
  segments: Fix[][];
};

/**
 * A deliberately small GPX reader: tracks and routes, with lat, lon, ele and
 * time. A full XML parser would be ~40 KB of bundle for files whose structure
 * is this regular; this handles attribute order, either quote style,
 * namespaces prefixes, CDATA names and self-closing points.
 */
export function parseGpx(xml: string): ParsedGpx {
  if (!/<(?:\w+:)?gpx[\s>]/i.test(xml)) throw new AppError('GPX_INVALID', 'Not a GPX file');

  const segments: Fix[][] = [];
  const containers = matchAll(xml, /<(?:\w+:)?(trkseg|rte)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/gi);
  for (const [, , content] of containers) {
    const fixes = parsePoints(content ?? '');
    if (fixes.length > 0) segments.push(fixes);
  }
  if (segments.length === 0) {
    // Some exporters emit bare <trkpt> without a <trkseg>.
    const loose = parsePoints(xml);
    if (loose.length > 0) segments.push(loose);
  }
  if (segments.length === 0)
    throw new AppError('GPX_EMPTY', 'The GPX file contains no track points');

  const trackName = /<(?:\w+:)?trk\b[^>]*>[\s\S]*?<(?:\w+:)?name>([\s\S]*?)<\/(?:\w+:)?name>/i.exec(
    xml,
  );
  const anyName = /<(?:\w+:)?name>([\s\S]*?)<\/(?:\w+:)?name>/i.exec(xml);
  const type = /<(?:\w+:)?type>([\s\S]*?)<\/(?:\w+:)?type>/i.exec(xml)?.[1]?.toLowerCase() ?? '';

  return {
    name: cleanText(trackName?.[1] ?? anyName?.[1] ?? null),
    activity: /cycl|bik|ride/.test(type) ? 'ride' : /run|jog/.test(type) ? 'run' : null,
    segments,
  };
}

function parsePoints(xml: string): Fix[] {
  const fixes: Fix[] = [];
  const points = matchAll(
    xml,
    /<(?:\w+:)?(?:trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?(?:trkpt|rtept)>)/gi,
  );
  let lastTime: number | null = null;
  for (const [, attributes = '', inner = ''] of points) {
    const lat = Number(attribute(attributes, 'lat'));
    const lon = Number(attribute(attributes, 'lon'));
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      continue;
    }
    const ele = /<(?:\w+:)?ele>([^<]*)</i.exec(inner)?.[1];
    const time = /<(?:\w+:)?time>([^<]*)</i.exec(inner)?.[1];
    const parsedTime = time ? Date.parse(time.trim()) : NaN;
    // Routes and planned tracks have no times. Space them a second apart so
    // they can still be replayed; real recordings always carry timestamps.
    const t: number = Number.isFinite(parsedTime) ? parsedTime : (lastTime ?? 0) + 1000;
    lastTime = t;
    const alt = ele !== undefined && ele.trim() !== '' ? Number(ele) : NaN;
    fixes.push({
      t,
      lat,
      lon,
      alt: Number.isFinite(alt) ? alt : null,
      accuracy: null,
      altitudeAccuracy: null,
      speed: null,
    });
  }
  return fixes;
}

function attribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attributes);
  return match?.[1] ?? match?.[2];
}

function matchAll(input: string, pattern: RegExp): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) results.push(match);
  return results;
}

function cleanText(raw: string | null): string | null {
  if (raw === null) return null;
  const text = unescapeXml(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
  return text.length > 0 ? text : null;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function iso(t: number): string {
  return new Date(t).toISOString();
}

function round(value: number, decimals: number): string {
  return Number(value.toFixed(decimals)).toString();
}

/** File name a runner would recognise in Files or an email attachment. */
export function gpxFileName(title: string, startedAt: number): string {
  const date = new Date(startedAt).toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${date}-${slug || 'activity'}.gpx`;
}
