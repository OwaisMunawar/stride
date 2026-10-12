import { isAppError } from '@/core/errors/AppError';
import { createEmitter } from '@/core/lib/store';
import { createRunRepository } from '@/features/history/data/runRepository';
import { type RunMeta } from '@/features/history/model';
import { summarizeRun } from '@/features/tracking/lib/summarize';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';
import { straightFixes, toPoints } from '@/test-utils/tracks';

import { createSessionRepository } from '../sessionRepository';

const meta = (id: string): RunMeta => ({
  id,
  title: 'Morning Run',
  activity: 'run',
  source: 'device',
  autoPause: 'normal',
  startedAt: 1_000,
});

async function setup() {
  const db = await createMigratedTestDriver();
  const changes = createEmitter<void>();
  return {
    db,
    changes,
    sessions: createSessionRepository(db, changes),
    runs: createRunRepository(db, changes),
  };
}

describe('sessionRepository', () => {
  it('begins a single active run with a start event', async () => {
    const { sessions } = await setup();
    await sessions.begin(meta('a'));
    expect(await sessions.active()).toEqual(meta('a'));
    expect(await sessions.activeRunId()).toBe('a');
    expect(await sessions.events('a')).toEqual([{ command: 'start', at: 1_000 }]);

    const error = await sessions.begin(meta('b')).catch((e: unknown) => e);
    expect(isAppError(error, 'RECORDING_ALREADY_ACTIVE')).toBe(true);
  });

  it('reads fixes back incrementally by cursor', async () => {
    const { sessions } = await setup();
    await sessions.begin(meta('a'));
    const fixes = straightFixes({ speedMps: 3, seconds: 9 });
    await sessions.appendFixes('a', fixes.slice(0, 4));
    await sessions.appendFixes('a', []);
    const first = await sessions.fixesAfter('a', 0);
    expect(first).toHaveLength(4);
    expect(first[0]).toEqual({ ...fixes[0], seq: first[0]!.seq });
    await sessions.appendFixes('a', fixes.slice(4));
    const rest = await sessions.fixesAfter('a', first.at(-1)!.seq);
    expect(rest.map((f) => f.t)).toEqual(fixes.slice(4).map((f) => f.t));
  });

  it('completes a run atomically: summary, track, no raw fixes left', async () => {
    const { sessions, runs, db, changes } = await setup();
    const listener = jest.fn();
    changes.on(listener);
    await sessions.begin(meta('a'));
    const fixes = straightFixes({ speedMps: 3, seconds: 60, startT: 1_000 });
    await sessions.appendFixes('a', fixes);
    await sessions.appendEvent('a', 'stop', 61_000);
    const points = toPoints(fixes);
    const summary = summarizeRun({
      points,
      activity: 'run',
      weightKg: 70,
      startedAt: 1_000,
      endedAt: 61_000,
    });
    await sessions.complete({ id: 'a', endedAt: 61_000, summary, points });

    expect(await sessions.active()).toBeNull();
    const [count] = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM fixes');
    expect(count?.n).toBe(0);
    const run = await runs.get('a');
    expect(run.summary.distanceM).toBeCloseTo(180, -1);
    expect(run.endedAt).toBe(61_000);
    expect(run.thumbnail.length).toBe(1);
    expect(await runs.points('a')).toHaveLength(points.length);
    expect(listener).toHaveBeenCalled();
  });

  it('discards a run with everything attached', async () => {
    const { sessions, db } = await setup();
    await sessions.begin(meta('a'));
    await sessions.appendFixes('a', straightFixes({ speedMps: 3, seconds: 3 }));
    await sessions.discard('a');
    expect(await sessions.active()).toBeNull();
    const [count] = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM fixes');
    expect(count?.n).toBe(0);
  });
});
