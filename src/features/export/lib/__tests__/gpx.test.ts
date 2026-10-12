import * as fc from 'fast-check';

import { isAppError } from '@/core/errors/AppError';
import { type TrackPoint } from '@/features/tracking/lib/types';

import { escapeXml, gpxFileName, parseGpx, writeGpx } from '../gpx';

const point = fc.record({
  lat: fc.double({ min: -89, max: 89, noNaN: true }),
  lon: fc.double({ min: -179, max: 179, noNaN: true }),
  alt: fc.option(fc.double({ min: -400, max: 8800, noNaN: true }), { nil: null }),
});

describe('GPX round trip', () => {
  it('preserves points, times, elevation and segments (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(point, { minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 4 }),
        fc.string({ maxLength: 30 }),
        (segments, name) => {
          let t = Date.UTC(2026, 8, 1, 7, 0, 0);
          const points: TrackPoint[] = segments.flatMap((segment, s) =>
            segment.map((p) => ({ ...p, t: (t += 1000), segment: s })),
          );
          const xml = writeGpx({ name, activity: 'run', startedAt: points[0]!.t, points });
          const parsed = parseGpx(xml);
          expect(parsed.segments).toHaveLength(segments.length);
          expect(parsed.activity).toBe('run');
          expect(parsed.name).toBe(name.trim() === '' ? null : name.trim());
          const flat = parsed.segments.flat();
          expect(flat).toHaveLength(points.length);
          flat.forEach((fix, i) => {
            const original = points[i]!;
            expect(fix.lat).toBeCloseTo(original.lat, 6);
            expect(fix.lon).toBeCloseTo(original.lon, 6);
            expect(fix.t).toBe(original.t);
            if (original.alt === null) expect(fix.alt).toBeNull();
            else expect(fix.alt).toBeCloseTo(original.alt, 0);
          });
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('parseGpx', () => {
  it('reads files from other apps: attribute order, quotes, namespaces, CDATA, routes', () => {
    const xml = `<?xml version="1.0"?>
      <gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1" version="1.1">
        <gpx:trk>
          <gpx:name><![CDATA[Lunch & Ride]]></gpx:name>
          <gpx:type>cycling</gpx:type>
          <gpx:trkseg>
            <gpx:trkpt lon='-122.4' lat='37.8'><gpx:ele>12</gpx:ele><gpx:time>2026-09-01T12:00:00Z</gpx:time></gpx:trkpt>
            <gpx:trkpt lat="37.8001" lon="-122.4001"/>
            <gpx:trkpt lat="999" lon="0"/>
          </gpx:trkseg>
        </gpx:trk>
      </gpx:gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed.name).toBe('Lunch & Ride');
    expect(parsed.activity).toBe('ride');
    const [first, second] = parsed.segments[0]!;
    expect(first).toMatchObject({
      lat: 37.8,
      lon: -122.4,
      alt: 12,
      t: Date.parse('2026-09-01T12:00:00Z'),
    });
    // No timestamp: spaced a second after the previous point.
    expect(second!.t).toBe(first!.t + 1000);
    expect(second!.alt).toBeNull();
    expect(parsed.segments[0]).toHaveLength(2);

    const route = parseGpx(
      '<gpx><rte><name>Plan</name><rtept lat="1" lon="2"></rtept></rte></gpx>',
    );
    expect(route).toMatchObject({ name: 'Plan', activity: null });
    expect(route.segments[0]![0]!.t).toBe(1000);

    const loose = parseGpx('<gpx><trkpt lat="1" lon="2"><time>bad</time></trkpt></gpx>');
    expect(loose.segments).toHaveLength(1);
    expect(
      parseGpx(
        '<gpx><trk><type>Running</type><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>',
      ).activity,
    ).toBe('run');
  });

  it('rejects files that are not GPX or have no points', () => {
    expect(
      isAppError(
        catchError(() => parseGpx('<kml></kml>')),
        'GPX_INVALID',
      ),
    ).toBe(true);
    expect(
      isAppError(
        catchError(() => parseGpx('<gpx><trk></trk></gpx>')),
        'GPX_EMPTY',
      ),
    ).toBe(true);
  });
});

describe('helpers', () => {
  it('escapes XML and builds file names', () => {
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;',
    );
    expect(gpxFileName('Morning Run!', Date.UTC(2026, 9, 1, 7))).toBe('2026-10-01-morning-run.gpx');
    expect(gpxFileName('***', Date.UTC(2026, 9, 1, 7))).toBe('2026-10-01-activity.gpx');
  });
});

function catchError(work: () => unknown): unknown {
  try {
    work();
    return null;
  } catch (error) {
    return error;
  }
}
