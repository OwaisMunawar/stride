import { AppError } from '@/core/errors/AppError';
import { createId } from '@/core/lib/id';
import { createEmitter, createStore, type Emitter, type Store } from '@/core/lib/store';
import { unitLength } from '@/core/units/units';
import { type RunMeta } from '@/features/history/model';
import { type Settings } from '@/features/settings/lib/settings';
import { type AutoPauseSensitivity } from '@/features/tracking/lib/autoPause';
import { defaultTitle, summarizeRun } from '@/features/tracking/lib/summarize';
import { trackerConfig } from '@/features/tracking/lib/tracker';
import { type ActivityType, type Fix, type TrackPoint } from '@/features/tracking/lib/types';

import { type SessionRepository } from '../data/sessionRepository';
import { type LiveActivityController } from '../live-activity/LiveActivityController';
import { activityProps, liveStats } from '../lib/liveStats';
import { isLive, type RecordingStatus } from '../lib/machine';
import {
  initialSession,
  movingMsAt,
  reduceSession,
  replaySession,
  type Command,
  type SessionConfig,
  type SessionInput,
  type SessionState,
} from '../lib/session';
import { type FixSink, type LocationSource } from '../location/LocationSource';

export type LiveSnapshot = {
  meta: RunMeta;
  session: SessionState;
  /** Replaced (not mutated) on every change, so React can compare by reference. */
  points: readonly TrackPoint[];
  source: LocationSource['kind'];
  clockRate: number;
};

export type SourceKind = LocationSource['kind'];

export type RecordingEngineDeps = {
  sessions: SessionRepository;
  /** Fired by the fix sink after fixes are persisted, with the run id. */
  fixesStored: Emitter<string>;
  createSource: (kind: SourceKind) => LocationSource;
  liveActivity: LiveActivityController;
  settings: () => Settings;
  onSplit?: (index: number) => void;
  wallClock?: () => number;
};

/** Live Activity updates are budgeted by iOS; status changes always go through. */
const ACTIVITY_MIN_INTERVAL_MS = 5_000;

/**
 * Orchestrates a recording: owns the active location source, folds stored
 * fixes and user commands through the pure session reducer, and pushes the
 * result to the UI store and the Live Activity.
 *
 * The engine never receives fixes directly. Sources write to SQLite through
 * the sink, then the engine reads back whatever is new. That one path is what
 * makes background recording and crash recovery the same code: after a
 * restart the engine just reads everything from the beginning.
 */
export function createRecordingEngine(deps: RecordingEngineDeps) {
  const wallClock = deps.wallClock ?? Date.now;
  const snapshot: Store<LiveSnapshot | null> = createStore<LiveSnapshot | null>(null);
  const finished = createEmitter<string>();

  let source: LocationSource | null = null;
  let config: SessionConfig | null = null;
  let cursor = 0;
  let queue: Promise<void> = Promise.resolve();
  let lastActivityPush = 0;
  let lastActivityStatus: RecordingStatus | null = null;

  /** Serialises all state changes; fixes and commands never interleave. */
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const configFor = (activity: ActivityType, autoPause: AutoPauseSensitivity): SessionConfig => ({
    tracker: trackerConfig(activity, autoPause),
    splitUnitM: unitLength(deps.settings().units),
  });

  const pushActivity = (current: LiveSnapshot, force: boolean) => {
    const wallNow = wallClock();
    const statusChanged = current.session.status !== lastActivityStatus;
    if (!force && !statusChanged && wallNow - lastActivityPush < ACTIVITY_MIN_INTERVAL_MS) return;
    const now = source?.now() ?? wallNow;
    const props = activityProps({
      activity: current.meta.activity,
      session: current.session,
      stats: liveStats(current.session, current.points, now),
      units: deps.settings().units,
      clockRate: current.clockRate,
      wallNow,
    });
    if (!props) return;
    if (lastActivityStatus === null) deps.liveActivity.start(props);
    else deps.liveActivity.update(props);
    lastActivityPush = wallNow;
    lastActivityStatus = current.session.status;
  };

  const apply = (inputs: readonly SessionInput[]) => {
    const current = snapshot.get();
    if (!current || !config) return;
    let session = current.session;
    let points = current.points;
    let appended: TrackPoint[] | null = null;
    for (const input of inputs) {
      const result = reduceSession(session, input, config);
      session = result.state;
      for (const effect of result.effects) {
        if (effect.type === 'point') (appended ??= []).push(effect.point);
        if (effect.type === 'split') deps.onSplit?.(effect.index);
      }
    }
    if (appended) points = [...points, ...appended];
    if (session === current.session && points === current.points) return;
    const next = { ...current, session, points };
    snapshot.set(next);
    pushActivity(next, false);
  };

  const drain = (runId: string) =>
    serial(async () => {
      const current = snapshot.get();
      if (!current || current.meta.id !== runId) return;
      const fixes = await deps.sessions.fixesAfter(runId, cursor);
      if (fixes.length === 0) return;
      cursor = fixes[fixes.length - 1]!.seq;
      apply(fixes.map((fix): SessionInput => ({ type: 'fix', fix })));
    });

  const unsubscribe = deps.fixesStored.on((runId) => void drain(runId));

  const command = (name: Command) =>
    serial(async () => {
      const current = snapshot.get();
      if (!current) throw new AppError('NO_ACTIVE_RECORDING', 'Nothing is being recorded');
      const at = Math.round(source?.now() ?? wallClock());
      await deps.sessions.appendEvent(current.meta.id, name, at);
      apply([{ type: 'command', command: name, at }]);
    });

  return {
    snapshot,
    /** Emits the id of each run as it is stored, for navigation and the coach. */
    finished,

    /** The clock live stats should be computed against (virtual during a replay). */
    now: () => source?.now() ?? wallClock(),

    /**
     * Rebuilds a recording that was in progress when the app was killed or
     * reloaded. Device recordings re-attach to the OS location updates, which
     * may well have kept running. A replay cannot pick up where it was, so it
     * is restored as it stood for the user to finish or discard.
     */
    restore: () =>
      serial(async () => {
        const meta = await deps.sessions.active();
        if (!meta) return;
        const [events, fixes] = await Promise.all([
          deps.sessions.events(meta.id),
          deps.sessions.fixesAfter(meta.id, 0),
        ]);
        config = configFor(meta.activity, meta.autoPause);
        const inputs: SessionInput[] = [
          ...events.map((e): SessionInput => ({ type: 'command', command: e.command, at: e.at })),
          ...fixes.map((fix): SessionInput => ({ type: 'fix', fix })),
        ];
        const { state, points } = replaySession(inputs, config);
        cursor = fixes[fixes.length - 1]?.seq ?? 0;
        source = deps.createSource(meta.source === 'replay' ? 'replay' : 'device');
        const restored: LiveSnapshot = {
          meta,
          session: state,
          points,
          source: source.kind,
          clockRate: source.rate,
        };
        snapshot.set(restored);
        if (source.kind === 'device' && isLive(state.status)) {
          await source.start(createSinkFor(meta.id)).catch((error: unknown) => {
            console.warn('[recording] could not re-attach to location updates', error);
          });
        }
        lastActivityStatus = state.status;
        pushActivity(restored, true);
      }),

    start: (activity: ActivityType, kind: SourceKind) =>
      serial(async () => {
        if (snapshot.get()) {
          throw new AppError('RECORDING_ALREADY_ACTIVE', 'A recording is already in progress');
        }
        const settings = deps.settings();
        const nextSource = deps.createSource(kind);
        const startedAt = Math.round(nextSource.now());
        const meta: RunMeta = {
          id: createId(wallClock()),
          title: defaultTitle(activity, startedAt),
          activity,
          source: kind,
          autoPause: settings.autoPause,
          startedAt,
        };
        await deps.sessions.begin(meta);
        config = configFor(activity, settings.autoPause);
        cursor = 0;
        source = nextSource;
        lastActivityStatus = null;
        const { state } = reduceSession(
          initialSession,
          { type: 'command', command: 'start', at: startedAt },
          config,
        );
        const started: LiveSnapshot = {
          meta,
          session: state,
          points: [],
          source: kind,
          clockRate: nextSource.rate,
        };
        snapshot.set(started);
        try {
          await nextSource.start(createSinkFor(meta.id));
        } catch (error) {
          await deps.sessions.discard(meta.id);
          snapshot.set(null);
          source = null;
          throw error;
        }
        pushActivity(started, true);
        return meta.id;
      }),

    pause: () => command('pause'),
    resume: () => command('resume'),

    /** Stops the source, computes the summary and stores the finished run. */
    finish: () =>
      serial(async () => {
        const current = snapshot.get();
        if (!current || !config)
          throw new AppError('NO_ACTIVE_RECORDING', 'Nothing is being recorded');
        const at = Math.round(source?.now() ?? wallClock());
        // Fold whatever the task stored since the last notification first.
        const pending = await deps.sessions.fixesAfter(current.meta.id, cursor);
        cursor = pending[pending.length - 1]?.seq ?? cursor;
        apply(pending.map((fix): SessionInput => ({ type: 'fix', fix })));
        await deps.sessions.appendEvent(current.meta.id, 'stop', at);
        apply([{ type: 'command', command: 'stop', at }]);
        await source?.stop();

        const final = snapshot.get()!;
        const summary = summarizeRun({
          points: final.points,
          activity: final.meta.activity,
          weightKg: deps.settings().weightKg,
          startedAt: final.meta.startedAt,
          endedAt: at,
          movingMs: movingMsAt(final.session, at),
        });
        await deps.sessions.complete({
          id: final.meta.id,
          endedAt: at,
          summary,
          points: final.points,
        });
        await deps.liveActivity.end();
        source = null;
        config = null;
        lastActivityStatus = null;
        snapshot.set(null);
        finished.emit(final.meta.id);
        return final.meta.id;
      }),

    /** Throws the recording away. Used for accidental starts. */
    discard: () =>
      serial(async () => {
        const current = snapshot.get();
        if (!current) return;
        await source?.stop();
        await deps.sessions.discard(current.meta.id);
        await deps.liveActivity.end();
        source = null;
        config = null;
        lastActivityStatus = null;
        snapshot.set(null);
      }),

    dispose() {
      unsubscribe();
    },
  };

  /**
   * Replay sources call the sink themselves; it stores then notifies, the same
   * as the background task does for the device source.
   */
  function createSinkFor(runId: string): FixSink {
    return async (fixes: readonly Fix[]) => {
      await deps.sessions.appendFixes(runId, fixes);
      deps.fixesStored.emit(runId);
    };
  }
}

/**
 * The sink the background task writes into. It looks the active run up on
 * every batch rather than capturing an id, because on a headless relaunch the
 * task can fire before any engine exists.
 */
export function createActiveRunSink(
  sessions: Pick<SessionRepository, 'activeRunId' | 'appendFixes'>,
  fixesStored: Emitter<string>,
): FixSink {
  return async (fixes) => {
    const runId = await sessions.activeRunId();
    if (!runId) return;
    await sessions.appendFixes(runId, fixes);
    fixesStored.emit(runId);
  };
}

export type RecordingEngine = ReturnType<typeof createRecordingEngine>;
