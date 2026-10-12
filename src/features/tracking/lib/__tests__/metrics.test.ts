import { straightFixes, toPoints } from '@/test-utils/tracks';

import { estimateCalories, rideMet } from '../calories';
import { elevationChange, elevationProfile, smoothAltitudes } from '../elevation';
import { paceSecPerKm, paceSeries, rollingPace } from '../pace';
import { paceSegments } from '../paceSegments';
import { simplify } from '../simplify';
import { defaultTitle, summarizeRun } from '../summarize';
import { type TrackPoint } from '../types';

describe('pace', () => {
  it('converts distance and time to seconds per km', () => {
    expect(paceSecPerKm(1000, 300_000)).toBe(300);
    expect(paceSecPerKm(0, 1000)).toBeNull();
    expect(paceSecPerKm(10, 0)).toBeNull();
  });

  it('computes rolling pace over the current segment only', () => {
    const points = toPoints(straightFixes({ speedMps: 4, seconds: 120 }));
    expect(rollingPace(points)).toBeCloseTo(250, 0);
    expect(rollingPace([])).toBeNull();
    expect(rollingPace(points.slice(0, 3))).toBeNull();
    const resumed = [
      ...points,
      ...toPoints(straightFixes({ speedMps: 2, seconds: 3, startT: points.at(-1)!.t + 1000 }), 1),
    ];
    // Only three seconds into the new segment: not enough distance to say.
    expect(rollingPace(resumed)).toBeNull();
  });

  it('buckets pace by distance and smooths it', () => {
    const fast = toPoints(straightFixes({ speedMps: 4, seconds: 100 }));
    const slow = toPoints(
      straightFixes({
        speedMps: 2,
        seconds: 200,
        startT: fast.at(-1)!.t + 1000,
        start: fast.at(-1)!,
      }),
    );
    const series = paceSeries([...fast, ...slow], 100, 0);
    expect(series[0]!.paceSecPerKm).toBeCloseTo(250, 0);
    expect(series.at(-1)!.paceSecPerKm).toBeCloseTo(500, 0);
    const smoothed = paceSeries([...fast, ...slow], 100, 2);
    expect(smoothed).toHaveLength(series.length);
  });
});

describe('elevation', () => {
  it('ignores noise on flat ground', () => {
    const points = toPoints(
      straightFixes({ speedMps: 3, seconds: 600, alt: (i) => 20 + Math.sin(i * 1.7) * 2 }),
    );
    const { gainM, lossM } = elevationChange(points);
    expect(gainM).toBeLessThan(3);
    expect(lossM).toBeLessThan(3);
  });

  it('measures a real climb and descent', () => {
    const points = toPoints(
      straightFixes({
        speedMps: 3,
        seconds: 600,
        alt: (i) => (i < 300 ? i / 6 : 50 - (i - 300) / 6),
      }),
    );
    const { gainM, lossM } = elevationChange(points);
    // The dead band and smoothing trim a few metres at each turning point.
    expect(gainM).toBeGreaterThan(40);
    expect(gainM).toBeLessThan(52);
    expect(lossM).toBeGreaterThan(40);
  });

  it('smooths around gaps and builds a profile against distance', () => {
    expect(smoothAltitudes([null, 10, 20, null], 1)).toEqual([null, 15, 15, null]);
    const profile = elevationProfile(toPoints(straightFixes({ speedMps: 2, seconds: 10 })));
    expect(profile).toHaveLength(11);
    expect(profile.at(-1)!.distanceM).toBeCloseTo(20, 0);
  });
});

describe('calories', () => {
  it('uses ~1 kcal/kg/km for running plus resting metabolism', () => {
    const kcal = estimateCalories({
      activity: 'run',
      distanceM: 10_000,
      movingMs: 3_600_000,
      weightKg: 70,
    });
    expect(kcal).toBeCloseTo(770, 0);
  });

  it('uses speed bands for riding', () => {
    expect(rideMet(10)).toBe(4);
    expect(rideMet(21)).toBe(8);
    expect(rideMet(40)).toBe(15.8);
    const kcal = estimateCalories({
      activity: 'ride',
      distanceM: 21_000,
      movingMs: 3_600_000,
      weightKg: 70,
    });
    expect(kcal).toBeCloseTo(560, 0);
  });

  it('returns zero for empty input', () => {
    expect(estimateCalories({ activity: 'run', distanceM: 0, movingMs: 1, weightKg: 70 })).toBe(0);
  });
});

describe('simplify', () => {
  it('keeps the shape and drops collinear points', () => {
    const line = toPoints(straightFixes({ speedMps: 3, seconds: 100 }));
    expect(simplify(line, 1)).toHaveLength(2);
    const corner = [
      ...line,
      ...toPoints(straightFixes({ start: line.at(-1)!, speedMps: 3, seconds: 100, bearingDeg: 0 })),
    ];
    expect(simplify(corner, 1)).toHaveLength(3);
    expect(simplify(line.slice(0, 2), 1)).toHaveLength(2);
  });

  it('handles repeated points', () => {
    const p: TrackPoint = { t: 0, lat: 1, lon: 1, alt: null, segment: 0 };
    expect(simplify([p, p, p], 1)).toHaveLength(2);
  });
});

describe('paceSegments', () => {
  it('colours fast stretches higher than slow ones and merges neighbours', () => {
    const slow = toPoints(straightFixes({ speedMps: 2, seconds: 300 }));
    const fast = toPoints(
      straightFixes({
        speedMps: 5,
        seconds: 120,
        start: slow.at(-1)!,
        startT: slow.at(-1)!.t + 1000,
      }),
    );
    const segments = paceSegments([...slow, ...fast], 5);
    expect(segments[0]!.level).toBe(0);
    expect(segments.at(-1)!.level).toBe(4);
    expect(segments.length).toBeLessThan(6);
  });

  it('uses the middle level for an even pace and handles empty input', () => {
    const even = toPoints(straightFixes({ speedMps: 3, seconds: 200 }));
    expect(new Set(paceSegments(even, 5).map((s) => s.level))).toEqual(new Set([2]));
    expect(paceSegments([], 5)).toEqual([]);
  });

  it('breaks at segment boundaries', () => {
    const a = toPoints(straightFixes({ speedMps: 3, seconds: 60 }), 0);
    const b = toPoints(
      straightFixes({ speedMps: 3, seconds: 60, startT: a.at(-1)!.t + 5000, bearingDeg: 0 }),
      1,
    );
    expect(paceSegments([...a, ...b], 5).length).toBeGreaterThanOrEqual(2);
  });
});

describe('summarizeRun', () => {
  it('summarises a track', () => {
    const points = toPoints(straightFixes({ speedMps: 3.5, seconds: 1200 }));
    const summary = summarizeRun({
      points,
      activity: 'run',
      weightKg: 70,
      startedAt: points[0]!.t,
      endedAt: points.at(-1)!.t + 30_000,
    });
    expect(summary.distanceM).toBeCloseTo(4200, -1);
    expect(summary.movingMs).toBe(1_200_000);
    expect(summary.elapsedMs).toBe(1_230_000);
    expect(summary.avgPaceSecPerKm).toBeCloseTo(285.7, 0);
    expect(summary.maxSpeedMps).toBeCloseTo(3.5, 1);
    expect(summary.bounds).not.toBeNull();
    expect(
      summarizeRun({ points: [], activity: 'run', weightKg: 70, startedAt: 0, endedAt: 0 })
        .maxSpeedMps,
    ).toBe(0);
  });

  it('prefers the state machine moving time when given', () => {
    const points = toPoints(straightFixes({ speedMps: 3, seconds: 100 }));
    expect(
      summarizeRun({
        points,
        activity: 'run',
        weightKg: 70,
        startedAt: 0,
        endedAt: 1,
        movingMs: 99_000,
      }).movingMs,
    ).toBe(99_000);
  });

  it('names activities by time of day', () => {
    const at = (hour: number) => new Date(2026, 9, 1, hour).getTime();
    expect(defaultTitle('run', at(7))).toBe('Morning Run');
    expect(defaultTitle('ride', at(14))).toBe('Afternoon Ride');
    expect(defaultTitle('run', at(19))).toBe('Evening Run');
    expect(defaultTitle('run', at(23))).toBe('Night Run');
    expect(defaultTitle('run', at(3))).toBe('Night Run');
  });
});
