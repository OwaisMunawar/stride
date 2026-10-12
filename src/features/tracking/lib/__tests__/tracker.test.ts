import * as fc from 'fast-check';

import { ORIGIN, pathLength, stationaryFixes, straightFixes } from '@/test-utils/tracks';

import { offset } from '../geo';
import {
  breakSegment,
  ingestFix,
  initialTracker,
  trackerConfig,
  type TrackerConfig,
  type TrackerState,
} from '../tracker';
import { type Fix, type TrackPoint } from '../types';

function run(fixes: readonly Fix[], config: TrackerConfig, holding = false, from = initialTracker) {
  let state: TrackerState = from;
  const points: TrackPoint[] = [];
  const rejected: string[] = [];
  const motion: string[] = [];
  for (const fix of fixes) {
    const step = ingestFix(state, fix, config, holding);
    state = step.state;
    if (step.point) points.push(step.point);
    if (step.rejected) rejected.push(step.rejected);
    if (step.motion) motion.push(step.motion.type);
  }
  return { state, points, rejected, motion };
}

const noPause = trackerConfig('run', 'off');

describe('ingestFix', () => {
  it('measures a clean constant-speed track to within 1% (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.5, max: 6, noNaN: true }),
        fc.integer({ min: 60, max: 900 }),
        fc.integer({ min: 0, max: 359 }),
        (speedMps, seconds, bearingDeg) => {
          const fixes = straightFixes({ speedMps, seconds, bearingDeg });
          const { state } = run(fixes, noPause);
          const truth = speedMps * seconds;
          expect(Math.abs(state.distanceM - truth) / truth).toBeLessThan(0.01);
        },
      ),
      { numRuns: 40 },
    );
  });

  it('keeps jitter from inflating distance much', () => {
    const fixes = straightFixes({ speedMps: 3, seconds: 600, jitterM: 4 });
    const raw = pathLength(fixes);
    const { state } = run(fixes, noPause);
    const truth = 3 * 600;
    // Raw fixes zig-zag around the line and overcount; the filter recovers most of it.
    expect(Math.abs(state.distanceM - truth)).toBeLessThan(Math.abs(raw - truth) / 2);
    expect(Math.abs(state.distanceM - truth) / truth).toBeLessThan(0.1);
  });

  it('rejects a single multipath spike and keeps going', () => {
    const fixes = straightFixes({ speedMps: 3, seconds: 60 });
    const spiked = fixes.map((f, i) =>
      i === 30 ? { ...f, ...offset(f, 0, 150), accuracy: 8 } : f,
    );
    const { state, rejected } = run(spiked, noPause);
    expect(rejected).toEqual(['impossibleSpeed']);
    expect(state.distanceM).toBeCloseTo(180, -1);
  });

  it('drops fixes with poor accuracy and stale timestamps', () => {
    const fixes = straightFixes({ speedMps: 3, seconds: 5 });
    const bad = [
      fixes[0]!,
      { ...fixes[1]!, accuracy: 80 },
      { ...fixes[2]!, t: fixes[0]!.t },
      fixes[3]!,
    ];
    const { rejected, points } = run(bad, noPause);
    expect(rejected).toEqual(['poorAccuracy', 'stale']);
    expect(points).toHaveLength(2);
  });

  it('re-anchors after a genuine jump and breaks the line instead of bridging it', () => {
    const before = straightFixes({ speedMps: 3, seconds: 20 });
    const after = straightFixes({
      start: offset(ORIGIN, 2000, 2000),
      startT: before[before.length - 1]!.t + 1000,
      speedMps: 3,
      seconds: 20,
    });
    const { points, rejected, state } = run([...before, ...after], noPause);
    expect(rejected.length).toBe(2);
    expect(new Set(points.map((p) => p.segment))).toEqual(new Set([0, 1]));
    // Distance is both stretches only, never the 2.8 km jump between them.
    expect(state.distanceM).toBeLessThan(150);
  });

  it('detects stopping and, while holding, emits nothing until moving again', () => {
    const config = trackerConfig('run', 'normal');
    const moving = straightFixes({ speedMps: 3, seconds: 30 });
    const last = moving[moving.length - 1]!;
    const stopped = stationaryFixes(last, last.t + 1000, 20);
    const first = run([...moving, ...stopped], config);
    expect(first.motion).toEqual(['stopped']);

    const resumed = straightFixes({
      start: last,
      startT: last.t + 22_000,
      speedMps: 3,
      seconds: 10,
    });
    const held = run(resumed, config, true, first.state);
    expect(held.motion).toEqual(['resumed']);
    // The first fast reading is held back; the second resumes and opens a new
    // segment. (Here every fix is fed while holding; the session stops
    // holding as soon as it sees the resume.)
    expect(held.points).toHaveLength(1);
    expect(held.points[0]!.segment).toBe(first.state.segment + 1);
    expect(held.points[0]!.t).toBe(resumed[1]!.t);
  });

  it('falls back to a windowed speed when the device reports none', () => {
    const config = trackerConfig('run', 'high');
    const moving = straightFixes({ speedMps: 3, seconds: 20, withSpeed: false });
    const last = moving[moving.length - 1]!;
    const still = stationaryFixes(last, last.t + 1000, 20).map((f) => ({ ...f, speed: null }));
    expect(run([...moving, ...still], config).motion).toEqual(['stopped']);
  });

  it('remembers the last fix for the GPS indicator, even when rejected', () => {
    const [fix] = straightFixes({ speedMps: 3, seconds: 0, accuracy: 90 });
    const { state } = run([fix!], noPause);
    expect(state.lastFix).toEqual({ t: fix!.t, accuracy: 90 });
  });
});

describe('breakSegment', () => {
  it('starts a new segment without adding the gap as distance', () => {
    const a = straightFixes({ speedMps: 3, seconds: 10 });
    const first = run(a, noPause);
    const b = straightFixes({
      start: offset(ORIGIN, 400, 0),
      startT: a[a.length - 1]!.t + 60_000,
      speedMps: 3,
      seconds: 10,
    });
    const second = run(b, noPause, false, breakSegment(first.state));
    expect(second.points[0]!.segment).toBe(1);
    // 10 s at 3 m/s; the restarted filter needs a couple of fixes to learn the velocity.
    expect(second.state.distanceM).toBeGreaterThan(50);
    expect(second.state.distanceM).toBeLessThan(62);
  });
});
