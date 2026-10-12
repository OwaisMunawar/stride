import { isAppError } from '@/core/errors/AppError';
import { type SqlDriver } from '@/core/db/SqlDriver';
import { createEmitter } from '@/core/lib/store';
import { createRunRepository } from '@/features/history/data/runRepository';
import { defaultSettings, type Settings } from '@/features/settings/lib/settings';
import {
  createFakeLiveActivity,
  createManualSource,
  flush,
  type ManualSource,
} from '@/test-utils/fakes';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';
import { stationaryFixes, straightFixes } from '@/test-utils/tracks';

import { createSessionRepository } from '../../data/sessionRepository';
import { createActiveRunSink, createRecordingEngine } from '../RecordingEngine';

const T0 = 1_700_000_000_000;

async function setup(
  options: { db?: SqlDriver; settings?: Partial<Settings>; wall?: () => number } = {},
) {
  const db = options.db ?? (await createMigratedTestDriver());
  const changes = createEmitter<void>();
  const fixesStored = createEmitter<string>();
  const sessions = createSessionRepository(db, changes);
  const runs = createRunRepository(db, changes);
  const live = createFakeLiveActivity();
  const sources: ManualSource[] = [];
  const onSplit = jest.fn();
  const settings: Settings = { ...defaultSettings, autoPause: 'off', ...options.settings };
  let wall = T0;
  const engine = createRecordingEngine({
    sessions,
    fixesStored,
    liveActivity: live.controller,
    settings: () => settings,
    onSplit,
    wallClock: options.wall ?? (() => wall),
    createSource: (kind) => {
      const source = createManualSource(kind, T0);
      sources.push(source);
      return source;
    },
  });
  return {
    db,
    engine,
    sessions,
    runs,
    live,
    sources,
    onSplit,
    fixesStored,
    setWall: (value: number) => (wall = value),
    source: () => sources[sources.length - 1]!,
  };
}

describe('RecordingEngine', () => {
  it('records a run end to end: start, fixes, splits, pause, resume, finish', async () => {
    const env = await setup();
    const finished = jest.fn();
    env.engine.finished.on(finished);

    const id = await env.engine.start('run', 'device');
    expect(env.engine.snapshot.get()?.session.status).toBe('recording');
    expect(env.source().start).toHaveBeenCalled();
    expect(env.live.calls[0]).toMatchObject({ method: 'start', props: { status: 'recording' } });

    const first = straightFixes({ speedMps: 4, seconds: 300, startT: T0 });
    await env.source().push(first);
    await flush();
    const snapshot = env.engine.snapshot.get()!;
    expect(snapshot.points).toHaveLength(first.length);
    expect(snapshot.session.tracker.distanceM).toBeCloseTo(1200, -2);
    expect(env.onSplit).toHaveBeenCalledWith(1);

    env.setWall(T0 + 301_000);
    await env.engine.pause();
    expect(env.engine.snapshot.get()?.session.status).toBe('paused');
    expect(env.live.calls.at(-1)).toMatchObject({ method: 'update', props: { status: 'paused' } });

    env.source().setNow(T0 + 400_000);
    await env.engine.resume();
    const second = straightFixes({
      speedMps: 4,
      seconds: 60,
      startT: T0 + 401_000,
      start: first.at(-1)!,
    });
    await env.source().push(second);
    await flush();

    const runId = await env.engine.finish();
    expect(runId).toBe(id);
    expect(env.engine.snapshot.get()).toBeNull();
    expect(env.source().stop).toHaveBeenCalled();
    expect(env.live.calls.at(-1)?.method).toBe('end');
    expect(finished).toHaveBeenCalledWith(id);

    const run = await env.runs.get(id);
    expect(run.summary.distanceM).toBeCloseTo(1440, -2);
    // Five minutes, then a minute after resuming; the pause is not moving time.
    expect(run.summary.movingMs).toBeGreaterThan(355_000);
    expect(run.summary.movingMs).toBeLessThan(365_000);
    expect(new Set((await env.runs.points(id)).map((p) => p.segment))).toEqual(new Set([0, 1]));
  });

  it('throttles Live Activity updates but always sends status changes', async () => {
    const env = await setup({ settings: { autoPause: 'high' } });
    await env.engine.start('run', 'device');
    const startCalls = env.live.calls.length;
    await env.source().push(straightFixes({ speedMps: 3, seconds: 3, startT: T0 }));
    await flush();
    // Same wall-clock second: no update yet.
    expect(env.live.calls.length).toBe(startCalls);

    const last = env.engine.snapshot.get()!.points.at(-1)!;
    await env.source().push(stationaryFixes(last, T0 + 4_000, 15));
    await flush();
    expect(env.engine.snapshot.get()?.session.status).toBe('autoPaused');
    expect(env.live.calls.at(-1)).toMatchObject({
      method: 'update',
      props: { status: 'autoPaused' },
    });

    env.setWall(T0 + 60_000);
    await env.source().push(stationaryFixes(last, T0 + 20_000, 2));
    await flush();
    expect(env.live.calls.length).toBeGreaterThan(startCalls + 1);
  });

  it('restores a recording after the app is killed, from what was stored', async () => {
    const first = await setup();
    const id = await first.engine.start('run', 'device');
    const fixes = straightFixes({ speedMps: 3, seconds: 120, startT: T0 });
    await first.source().push(fixes);
    await flush();
    const before = first.engine.snapshot.get()!;
    first.engine.dispose();

    // A fresh process: same database, new engine.
    const second = await setup({ db: first.db });
    await second.engine.restore();
    const after = second.engine.snapshot.get()!;
    expect(after.meta.id).toBe(id);
    expect(after.points).toHaveLength(before.points.length);
    expect(after.session.tracker.distanceM).toBeCloseTo(before.session.tracker.distanceM, 6);
    expect(second.source().start).toHaveBeenCalled();
    expect(second.live.calls[0]).toMatchObject({ method: 'update' });

    // And keeps folding new fixes from where it left off.
    await second
      .source()
      .push(
        straightFixes({ speedMps: 3, seconds: 10, startT: T0 + 121_000, start: fixes.at(-1)! }),
      );
    await flush();
    expect(second.engine.snapshot.get()!.points.length).toBe(before.points.length + 11);
  });

  it('does nothing on restore when no run is active', async () => {
    const env = await setup();
    await env.engine.restore();
    expect(env.engine.snapshot.get()).toBeNull();
    expect(env.sources).toHaveLength(0);
  });

  it('discards the run if the location source cannot start', async () => {
    const env = await setup();
    const engine = createRecordingEngine({
      sessions: env.sessions,
      fixesStored: env.fixesStored,
      liveActivity: env.live.controller,
      settings: () => defaultSettings,
      createSource: () => ({
        ...createManualSource('device'),
        start: async () => {
          throw new Error('denied');
        },
      }),
    });
    await expect(engine.start('run', 'device')).rejects.toThrow('denied');
    expect(engine.snapshot.get()).toBeNull();
    expect(await env.sessions.active()).toBeNull();
  });

  it('refuses a second start and commands without a recording', async () => {
    const env = await setup();
    expect(
      isAppError(await env.engine.pause().catch((e: unknown) => e), 'NO_ACTIVE_RECORDING'),
    ).toBe(true);
    expect(
      isAppError(await env.engine.finish().catch((e: unknown) => e), 'NO_ACTIVE_RECORDING'),
    ).toBe(true);
    await env.engine.start('ride', 'replay');
    expect(env.engine.snapshot.get()?.source).toBe('replay');
    const error = await env.engine.start('run', 'device').catch((e: unknown) => e);
    expect(isAppError(error, 'RECORDING_ALREADY_ACTIVE')).toBe(true);
  });

  it('discards a recording on request', async () => {
    const env = await setup();
    await env.engine.start('run', 'device');
    await env.engine.discard();
    expect(env.engine.snapshot.get()).toBeNull();
    expect(await env.sessions.active()).toBeNull();
    expect(env.live.calls.at(-1)?.method).toBe('end');
    await env.engine.discard();
  });

  it('ignores notifications for other runs', async () => {
    const env = await setup();
    await env.engine.start('run', 'device');
    env.fixesStored.emit('someone-else');
    await flush();
    expect(env.engine.snapshot.get()?.points).toHaveLength(0);
    expect(env.engine.now()).toBe(T0);
  });
});

describe('createActiveRunSink', () => {
  it('stores into whichever run is active and notifies', async () => {
    const env = await setup();
    const emitted = jest.fn();
    env.fixesStored.on(emitted);
    const sink = createActiveRunSink(env.sessions, env.fixesStored);
    await sink(straightFixes({ speedMps: 3, seconds: 2 }));
    expect(emitted).not.toHaveBeenCalled();

    const id = await env.engine.start('run', 'device');
    await sink(straightFixes({ speedMps: 3, seconds: 2, startT: T0 }));
    expect(emitted).toHaveBeenCalledWith(id);
    expect(await env.sessions.fixesAfter(id, 0)).toHaveLength(3);
  });
});
