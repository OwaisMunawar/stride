import { isAppError } from '@/core/errors/AppError';
import { createEmitter } from '@/core/lib/store';
import { summarizeRun } from '@/features/tracking/lib/summarize';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';
import { straightFixes, toPoints } from '@/test-utils/tracks';

import { createRunRepository } from '../runRepository';

async function setup() {
  const db = await createMigratedTestDriver();
  const changes = createEmitter<void>();
  return { db, runs: createRunRepository(db, changes), changes };
}

async function insert(
  runs: Awaited<ReturnType<typeof setup>>['runs'],
  id: string,
  startedAt: number,
) {
  const points = toPoints(straightFixes({ speedMps: 3, seconds: 120, startT: startedAt }));
  const summary = summarizeRun({
    points,
    activity: 'run',
    weightKg: 70,
    startedAt,
    endedAt: startedAt + 120_000,
  });
  await runs.insertFinished({
    meta: {
      id,
      title: `Run ${id}`,
      activity: 'run',
      source: 'import',
      autoPause: 'off',
      startedAt,
    },
    endedAt: startedAt + 120_000,
    summary,
    points,
  });
}

describe('runRepository', () => {
  it('lists finished runs newest first with their summaries', async () => {
    const { runs } = await setup();
    const listener = jest.fn();
    const unsubscribe = runs.subscribe(listener);
    await insert(runs, 'a', 1_000);
    await insert(runs, 'b', 5_000_000);
    const list = await runs.list();
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
    expect(list[0]!.summary.avgPaceSecPerKm).toBeCloseTo(333, -1);
    expect(list[0]!.source).toBe('import');
    expect(await runs.count()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('returns points in order, renames and removes', async () => {
    const { runs } = await setup();
    await insert(runs, 'a', 1_000);
    const points = await runs.points('a');
    expect(points).toHaveLength(121);
    expect(points[0]).toMatchObject({ t: 1_000, segment: 0 });
    await runs.rename('a', '  ');
    expect((await runs.get('a')).title).toBe('Untitled');
    await runs.rename('a', 'Hill reps');
    expect((await runs.get('a')).title).toBe('Hill reps');
    await runs.remove('a');
    expect(await runs.points('a')).toEqual([]);
    const error = await runs.get('a').catch((e: unknown) => e);
    expect(isAppError(error, 'RUN_NOT_FOUND')).toBe(true);
  });

  it('tolerates a corrupt thumbnail', async () => {
    const { runs, db } = await setup();
    await insert(runs, 'a', 1_000);
    await db.run("UPDATE runs SET thumbnail = 'not json' WHERE id = 'a'");
    expect((await runs.get('a')).thumbnail).toEqual([]);
    await db.run("UPDATE runs SET thumbnail = '{}' WHERE id = 'a'");
    expect((await runs.get('a')).thumbnail).toEqual([]);
    await db.run("UPDATE runs SET thumbnail = NULL WHERE id = 'a'");
    expect((await runs.get('a')).thumbnail).toEqual([]);
  });
});
