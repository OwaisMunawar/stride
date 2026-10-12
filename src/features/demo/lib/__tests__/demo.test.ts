import { createEmitter } from '@/core/lib/store';
import { createRunRepository } from '@/features/history/data/runRepository';
import { haversine } from '@/features/tracking/lib/geo';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { seedDemoRuns } from '../../data/seedDemoRuns';
import { buildPath, generateTrack } from '../generateTrack';
import { gaussian, seededRandom } from '../random';
import { CRISSY_FIELD, DEMO_ROUTES } from '../routes';
import { demoPlans, demoTracks } from '../seedPlan';

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

describe('demo data', () => {
  it('is deterministic', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(Number.isFinite(gaussian(seededRandom(1)))).toBe(true);
    expect(demoTracks(NOW)[0]!.fixes).toEqual(demoTracks(NOW)[0]!.fixes);
  });

  it('lays out-and-back routes to the requested distance', () => {
    const path = buildPath(CRISSY_FIELD, 5000);
    expect(path.at(-1)!.d).toBeCloseTo(5000, 6);
    // Turned around: the end is closer to the start than the far end of the route is.
    const span = haversine(CRISSY_FIELD.waypoints[0]!, CRISSY_FIELD.waypoints.at(-1)!);
    expect(haversine(path[0]!.point, path.at(-1)!.point)).toBeLessThan(span);
    for (const route of DEMO_ROUTES) expect(route.waypoints.length).toBeGreaterThan(5);
  });

  it('generates 1 Hz fixes with realistic noise, stops and the occasional spike', () => {
    const fixes = generateTrack(
      {
        route: CRISSY_FIELD,
        startedAt: NOW,
        distanceM: 3000,
        paceSecPerKm: 330,
        trend: 0,
        stops: [{ atM: 1000, seconds: 20 }],
        withSpeed: true,
      },
      seededRandom(3),
    );
    const duration = (fixes.at(-1)!.t - fixes[0]!.t) / 1000;
    expect(duration).toBeGreaterThan(3000 * 0.33 * 0.9 + 20);
    expect(fixes.filter((f) => f.speed! < 0.5).length).toBeGreaterThanOrEqual(20);
    expect(fixes.every((f) => f.accuracy! > 3)).toBe(true);
  });

  it('plans ten sessions in the past with a streak into today', () => {
    const plans = demoPlans(NOW);
    expect(plans).toHaveLength(10);
    expect(plans.every((p) => p.startedAt < NOW)).toBe(true);
    expect(plans.filter((p) => p.route.activity === 'ride')).toHaveLength(2);
  });

  it('seeds once, through the real pipeline', async () => {
    const db = await createMigratedTestDriver();
    const runs = createRunRepository(db, createEmitter<void>());
    expect(await seedDemoRuns({ runs, weightKg: 70, now: NOW })).toBe(10);
    expect(await seedDemoRuns({ runs, weightKg: 70, now: NOW })).toBe(0);
    const list = await runs.list();
    expect(list).toHaveLength(10);
    const latest = list[0]!;
    expect(latest.source).toBe('demo');
    // Planned 7.2 km at 5:26; the filter should land within a few percent.
    expect(latest.summary.distanceM / 7200).toBeGreaterThan(0.95);
    expect(latest.summary.distanceM / 7200).toBeLessThan(1.05);
    expect(latest.summary.avgPaceSecPerKm! / 326).toBeGreaterThan(0.95);
    expect(latest.summary.avgPaceSecPerKm! / 326).toBeLessThan(1.05);
  });
});
