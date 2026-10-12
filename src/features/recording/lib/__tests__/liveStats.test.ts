import { straightFixes, toPoints } from '@/test-utils/tracks';
import { trackerConfig } from '@/features/tracking/lib/tracker';

import { gpsQuality } from '../gpsQuality';
import { activityProps, liveStats, primaryRate } from '../liveStats';
import { processTrack } from '../processTrack';
import { initialSession, reduceSession, type SessionState } from '../session';

const T0 = 1_700_000_000_000;

function started(): SessionState {
  return reduceSession(
    initialSession,
    { type: 'command', command: 'start', at: T0 },
    {
      tracker: trackerConfig('run', 'off'),
      splitUnitM: 1000,
    },
  ).state;
}

describe('gpsQuality', () => {
  it('grades by accuracy and goes stale without fixes', () => {
    expect(gpsQuality(null, 0)).toBe('searching');
    expect(gpsQuality({ t: 0, accuracy: 4 }, 20_000)).toBe('searching');
    expect(gpsQuality({ t: 0, accuracy: 4 }, 1000)).toBe('good');
    expect(gpsQuality({ t: 0, accuracy: 18 }, 1000)).toBe('fair');
    expect(gpsQuality({ t: 0, accuracy: 60 }, 1000)).toBe('poor');
    expect(gpsQuality({ t: 0, accuracy: null }, 1000)).toBe('fair');
  });
});

describe('liveStats and primaryRate', () => {
  it('shows a current pace only while recording', () => {
    const session = { ...started(), tracker: { ...started().tracker, distanceM: 1000 } };
    const points = toPoints(straightFixes({ speedMps: 4, seconds: 60, startT: T0 }));
    const stats = liveStats(session, points, T0 + 250_000);
    expect(stats.movingMs).toBe(250_000);
    expect(stats.avgPaceSecPerKm).toBeCloseTo(250, 0);
    expect(stats.currentPaceSecPerKm).toBeCloseTo(250, 0);
    expect(liveStats({ ...session, status: 'paused' }, points, T0).currentPaceSecPerKm).toBeNull();
  });

  it('shows pace for runs and speed for rides', () => {
    expect(primaryRate('run', 300, 'metric')).toEqual({ value: '5:00', label: '/km' });
    expect(primaryRate('ride', 120, 'metric')).toEqual({ value: '30.0', label: 'km/h' });
    expect(primaryRate('ride', null, 'imperial')).toEqual({ value: '--', label: 'mph' });
  });
});

describe('activityProps', () => {
  const stats = {
    movingMs: 600_000,
    distanceM: 2500,
    currentPaceSecPerKm: 240,
    avgPaceSecPerKm: 240,
  };

  it('uses the native timer in real time and freezes it when paused', () => {
    const recording = activityProps({
      activity: 'run',
      session: started(),
      stats,
      units: 'metric',
      clockRate: 1,
      wallNow: 1_000_000,
    });
    expect(recording).toMatchObject({
      status: 'recording',
      timerStart: 400_000,
      pausedAt: null,
      distance: '2.50',
      distanceUnit: 'km',
      pace: '4:00',
      paceLabel: '/km',
      elapsed: '10:00',
    });
    const paused = activityProps({
      activity: 'run',
      session: { ...started(), status: 'paused' },
      stats,
      units: 'imperial',
      clockRate: 1,
      wallNow: 1_000_000,
    });
    expect(paused).toMatchObject({ status: 'paused', pausedAt: 1_000_000, distanceUnit: 'mi' });
  });

  it('falls back to text when the clock is not real time, and to nothing when not live', () => {
    const replay = activityProps({
      activity: 'ride',
      session: started(),
      stats: { ...stats, currentPaceSecPerKm: null },
      units: 'metric',
      clockRate: 10,
      wallNow: 0,
    });
    expect(replay).toMatchObject({ timerStart: null, pace: '15.0', paceLabel: 'km/h' });
    expect(
      activityProps({
        activity: 'run',
        session: initialSession,
        stats,
        units: 'metric',
        clockRate: 1,
        wallNow: 0,
      }),
    ).toBeNull();
  });
});

describe('processTrack', () => {
  it('runs an imported track through the live pipeline, segments becoming pauses', () => {
    const a = straightFixes({ speedMps: 3, seconds: 300, startT: T0 });
    const b = straightFixes({ speedMps: 3, seconds: 300, startT: T0 + 900_000, start: a.at(-1)! });
    const result = processTrack({
      segments: [a, b],
      activity: 'run',
      autoPause: 'normal',
      weightKg: 70,
    })!;
    expect(result.startedAt).toBe(T0);
    expect(result.endedAt).toBe(b.at(-1)!.t);
    expect(result.summary.distanceM).toBeCloseTo(1800, -1);
    // Ten minutes of running; the 10-minute gap between files' segments is a pause.
    expect(result.summary.movingMs).toBeGreaterThan(590_000);
    expect(result.summary.movingMs).toBeLessThan(602_000);
    expect(new Set(result.points.map((p) => p.segment)).size).toBe(2);
    expect(
      processTrack({ segments: [[]], activity: 'run', autoPause: 'off', weightKg: 70 }),
    ).toBeNull();
  });
});
