import * as fc from 'fast-check';

import { METRES_PER_MILE } from '@/core/units/units';
import { straightFixes, toPoints } from '@/test-utils/tracks';

import { computeSplits, movingTimeMs, trackDistance } from '../splits';

describe('computeSplits', () => {
  it('produces floor(distance / unit) full splits whose times add up (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 2, max: 6, noNaN: true }),
        fc.integer({ min: 120, max: 3600 }),
        fc.constantFrom(1000, METRES_PER_MILE),
        (speedMps, seconds, unit) => {
          const points = toPoints(straightFixes({ speedMps, seconds }));
          const distance = trackDistance(points);
          const splits = computeSplits(points, unit);
          const full = splits.filter((s) => !s.partial);
          expect(full).toHaveLength(Math.floor(distance / unit + 1e-9));
          full.forEach((s, i) => {
            expect(s.index).toBe(i + 1);
            expect(s.distanceM).toBe(unit);
            // Constant speed: every split has the same pace.
            expect(s.paceSecPerKm).toBeCloseTo(1000 / speedMps, 0);
          });
          const total = splits.reduce((sum, s) => sum + s.durationMs, 0);
          const partialTail = distance - full.length * unit;
          const expected =
            partialTail >= 50
              ? movingTimeMs(points)
              : movingTimeMs(points) - (partialTail / speedMps) * 1000;
          expect(total).toBeCloseTo(expected, -2);
        },
      ),
      { numRuns: 60 },
    );
  });

  it('excludes the gap between segments from distance and time', () => {
    const a = toPoints(straightFixes({ speedMps: 4, seconds: 200 }), 0);
    const b = toPoints(
      straightFixes({
        speedMps: 4,
        seconds: 200,
        startT: a[a.length - 1]!.t + 600_000,
        bearingDeg: 0,
      }),
      1,
    );
    const points = [...a, ...b];
    expect(movingTimeMs(points)).toBe(400_000);
    expect(trackDistance(points)).toBeCloseTo(1600, -1);
    const [first] = computeSplits(points, 1000);
    expect(first!.durationMs).toBeCloseTo(250_000, -3);
  });

  it('reports elevation change per split and ignores tiny trailing partials', () => {
    const points = toPoints(straightFixes({ speedMps: 5, seconds: 210, alt: (i) => i * 0.1 }));
    const splits = computeSplits(points, 1000);
    expect(splits[0]!.elevationDeltaM).toBeCloseTo(20, 0);
    expect(splits.at(-1)!.partial).toBe(false);
    expect(computeSplits(points.slice(0, 5), 1000)).toEqual([]);
  });

  it('handles missing altitude', () => {
    const points = toPoints(straightFixes({ speedMps: 5, seconds: 400, alt: () => null }));
    expect(computeSplits(points, 1000)[0]!.elevationDeltaM).toBe(0);
  });
});
