import { straightFixes, toPoints } from '@/test-utils/tracks';

import { buildThumbnail, projectToBox, thumbnailToLatLon } from '../thumbnail';
import {
  currentStreak,
  previousWeekDistance,
  startOfDay,
  startOfWeek,
  weekTotals,
} from '../weekly';

// Wednesday 14 October 2026, 10:00 local time.
const NOW = new Date(2026, 9, 14, 10, 0).getTime();
const at = (day: number, hour = 8) => new Date(2026, 9, day, hour).getTime();
const run = (day: number, km: number, hour = 8) => ({
  startedAt: at(day, hour),
  distanceM: km * 1000,
  movingMs: km * 330_000,
});

describe('weekly', () => {
  it('starts weeks on Monday in local time', () => {
    expect(new Date(startOfWeek(NOW)).getDate()).toBe(12);
    expect(new Date(startOfWeek(at(18, 23))).getDate()).toBe(12);
    expect(startOfDay(at(14, 23))).toBe(at(14, 0));
  });

  it('totals this week by day', () => {
    const totals = weekTotals(
      [run(12, 5), run(14, 8, 7), run(14, 2, 19), run(11, 21), run(19, 3)],
      NOW,
    );
    expect(totals.runs).toBe(3);
    expect(totals.distanceM).toBe(15_000);
    expect(totals.days).toEqual([5000, 0, 10_000, 0, 0, 0, 0]);
    expect(totals.movingMs).toBe(15 * 330_000);
  });

  it('compares with the previous week', () => {
    expect(previousWeekDistance([run(5, 10), run(11, 6), run(12, 3), run(4, 9)], NOW)).toBe(16_000);
  });

  it('counts a streak that survives until the end of the next day', () => {
    expect(currentStreak([run(12, 5), run(13, 5)], NOW)).toBe(2);
    expect(currentStreak([run(12, 5), run(13, 5), run(14, 5)], NOW)).toBe(3);
    expect(currentStreak([run(11, 5), run(12, 5)], NOW)).toBe(0);
    expect(currentStreak([], NOW)).toBe(0);
    // Two activities on one day count once.
    expect(currentStreak([run(13, 5, 7), run(13, 5, 18)], NOW)).toBe(1);
  });
});

describe('thumbnail', () => {
  it('stores a small simplified polyline per segment', () => {
    const a = toPoints(straightFixes({ speedMps: 3, seconds: 600 }), 0);
    const b = toPoints(
      straightFixes({
        speedMps: 3,
        seconds: 300,
        bearingDeg: 0,
        start: a.at(-1)!,
        startT: a.at(-1)!.t + 1000,
      }),
      1,
    );
    const thumbnail = buildThumbnail([...a, ...b]);
    expect(thumbnail).toHaveLength(2);
    expect(thumbnail.flat().length).toBeLessThan(10);
    expect(buildThumbnail([])).toEqual([]);
  });

  it('projects into a box with north up and the aspect ratio kept', () => {
    const east = toPoints(straightFixes({ speedMps: 3, seconds: 100, bearingDeg: 90 }));
    const north = toPoints(
      straightFixes({ speedMps: 3, seconds: 50, bearingDeg: 0, start: east.at(-1)! }),
    );
    const lines = thumbnailToLatLon(buildThumbnail([...east, ...north]));
    const [projected] = projectToBox(lines, 100, 100, 10);
    const xs = projected!.map((p) => p.x);
    const ys = projected!.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(10, 0);
    expect(Math.max(...xs)).toBeCloseTo(90, 0);
    // Half as tall as wide, centred vertically, and the northward leg goes up.
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(40, 0);
    expect(projected!.at(-1)!.y).toBeLessThan(projected![0]!.y);
    expect(projectToBox([], 10, 10, 1)).toEqual([]);
  });
});
