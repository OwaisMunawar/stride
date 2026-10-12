import * as fc from 'fast-check';

import { stationaryFixes, straightFixes } from '@/test-utils/tracks';
import { trackerConfig } from '@/features/tracking/lib/tracker';

import {
  initialSession,
  movingMsAt,
  reduceSession,
  replaySession,
  type SessionConfig,
  type SessionInput,
  type SessionState,
} from '../session';

const T0 = 1_700_000_000_000;
const config: SessionConfig = { tracker: trackerConfig('run', 'normal'), splitUnitM: 1000 };
const noAutoPause: SessionConfig = { tracker: trackerConfig('run', 'off'), splitUnitM: 1000 };

function apply(inputs: SessionInput[], cfg = config, from: SessionState = initialSession) {
  let state = from;
  const effects = [];
  for (const input of inputs) {
    const result = reduceSession(state, input, cfg);
    state = result.state;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const cmd = (command: 'start' | 'pause' | 'resume' | 'stop', at: number): SessionInput => ({
  type: 'command',
  command,
  at,
});
const fixes = (list: ReturnType<typeof straightFixes>): SessionInput[] =>
  list.map((fix) => ({ type: 'fix', fix }));

describe('reduceSession', () => {
  it('ignores fixes before start and after stop', () => {
    const track = straightFixes({ speedMps: 3, seconds: 10, startT: T0 });
    const before = apply(fixes(track));
    expect(before.state).toBe(initialSession);
    const after = apply([cmd('start', T0), cmd('stop', T0 + 1), ...fixes(track)]);
    expect(after.state.tracker.distanceM).toBe(0);
    expect(after.state.status).toBe('finished');
    expect(after.state.endedAt).toBe(T0 + 1);
  });

  it('counts moving time only while recording', () => {
    const { state } = apply([
      cmd('start', T0),
      cmd('pause', T0 + 60_000),
      cmd('resume', T0 + 90_000),
      cmd('stop', T0 + 120_000),
    ]);
    expect(state.activeMs).toBe(90_000);
    expect(movingMsAt(state, T0 + 999_999)).toBe(90_000);
  });

  it('includes the open interval when asked for the time now', () => {
    const { state } = apply([cmd('start', T0)]);
    expect(movingMsAt(state, T0 + 5_000)).toBe(5_000);
  });

  it('drops fixes during a manual pause and starts a new segment after it', () => {
    const a = straightFixes({ speedMps: 3, seconds: 30, startT: T0 });
    const during = straightFixes({
      speedMps: 3,
      seconds: 30,
      startT: T0 + 31_000,
      start: a.at(-1)!,
    });
    const b = straightFixes({
      speedMps: 3,
      seconds: 30,
      startT: T0 + 62_000,
      start: during.at(-1)!,
    });
    const { state, effects } = apply(
      [
        cmd('start', T0),
        ...fixes(a),
        cmd('pause', T0 + 30_500),
        ...fixes(during),
        cmd('resume', T0 + 61_500),
        ...fixes(b),
      ],
      noAutoPause,
    );
    const points = effects.flatMap((e) => (e.type === 'point' ? [e.point] : []));
    expect(points).toHaveLength(a.length + b.length);
    expect(new Set(points.map((p) => p.segment))).toEqual(new Set([0, 1]));
    // About 180 m of running; the 90 m walked while paused is not counted.
    expect(state.tracker.distanceM).toBeGreaterThan(160);
    expect(state.tracker.distanceM).toBeLessThan(185);
  });

  it('auto-pauses at a crossing, back-dated, and resumes when running again', () => {
    const run1 = straightFixes({ speedMps: 3, seconds: 60, startT: T0 });
    const wait = stationaryFixes(run1.at(-1)!, T0 + 61_000, 30);
    const run2 = straightFixes({
      speedMps: 3,
      seconds: 60,
      startT: T0 + 92_000,
      start: run1.at(-1)!,
    });
    const { state, effects } = apply([
      cmd('start', T0),
      ...fixes(run1),
      ...fixes(wait),
      ...fixes(run2),
    ]);
    const statuses = effects.flatMap((e) => (e.type === 'status' ? [e.status] : []));
    expect(statuses).toEqual(['recording', 'autoPaused', 'recording']);
    // 60 s + 60 s of running, minus the first second of each stretch before
    // the detector decides. The 30 s wait is excluded.
    expect(movingMsAt(state, T0 + 152_000)).toBeGreaterThan(115_000);
    expect(movingMsAt(state, T0 + 152_000)).toBeLessThan(123_000);
  });

  it('emits one split event per completed unit', () => {
    const track = straightFixes({ speedMps: 4, seconds: 600, startT: T0 });
    const { effects } = apply([cmd('start', T0), ...fixes(track)], noAutoPause);
    expect(effects.flatMap((e) => (e.type === 'split' ? [e.index] : []))).toEqual([1, 2]);
  });

  it('ignores commands that do not apply', () => {
    const started = apply([cmd('start', T0)]).state;
    expect(reduceSession(started, cmd('resume', T0 + 1), config)).toEqual({
      state: started,
      effects: [],
    });
    expect(reduceSession(started, cmd('start', T0 + 1), config).effects).toEqual([]);
  });
});

describe('replaySession', () => {
  it('rebuilds the same state as incremental folding, whatever the order stored (property)', () => {
    const track = straightFixes({ speedMps: 3, seconds: 120, startT: T0, jitterM: 2 });
    fc.assert(
      fc.property(
        fc.integer({ min: 5_000, max: 50_000 }),
        fc.integer({ min: 1_000, max: 30_000 }),
        (pauseAfter, pauseFor) => {
          const inputs: SessionInput[] = [
            cmd('start', T0),
            ...fixes(track),
            cmd('pause', T0 + pauseAfter),
            cmd('resume', T0 + pauseAfter + pauseFor),
            cmd('stop', T0 + 120_000),
          ];
          const ordered = [...inputs].sort(
            (a, b) =>
              (a.type === 'command' ? a.at : a.fix.t) - (b.type === 'command' ? b.at : b.fix.t) ||
              (a.type === 'command' ? 0 : 1) - (b.type === 'command' ? 0 : 1),
          );
          const incremental = apply(ordered);
          const replayed = replaySession(inputs, config);
          expect(replayed.state).toEqual(incremental.state);
          expect(replayed.points).toHaveLength(
            incremental.effects.filter((e) => e.type === 'point').length,
          );
        },
      ),
      { numRuns: 25 },
    );
  });

  it('puts a command before a fix stamped at the same millisecond', () => {
    const [fix] = straightFixes({ speedMps: 3, seconds: 0, startT: T0 });
    const { points } = replaySession([{ type: 'fix', fix: fix! }, cmd('start', T0)], config);
    expect(points).toHaveLength(1);
  });
});
