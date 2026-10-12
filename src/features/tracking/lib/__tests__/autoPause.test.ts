import * as fc from 'fast-check';

import { autoPauseConfig, detectMotion, initialMotion, type MotionState } from '../autoPause';

const config = autoPauseConfig('run', 'normal')!;

function feed(
  readings: readonly { t: number; speedMps: number }[],
  start: MotionState = initialMotion,
) {
  let state = start;
  const changes = [];
  for (const reading of readings) {
    const result = detectMotion(state, reading, config);
    state = result.state;
    if (result.change) changes.push(result.change);
  }
  return { state, changes };
}

describe('autoPauseConfig', () => {
  it('is off when asked and scales thresholds for rides', () => {
    expect(autoPauseConfig('run', 'off')).toBeNull();
    const run = autoPauseConfig('run', 'high')!;
    const ride = autoPauseConfig('ride', 'high')!;
    expect(ride.stopSpeedMps).toBeCloseTo(run.stopSpeedMps * 2.5);
    expect(ride.dwellMs).toBe(run.dwellMs);
    expect(autoPauseConfig('run', 'low')!.dwellMs).toBeGreaterThan(run.dwellMs);
  });
});

describe('detectMotion', () => {
  it('stops after the dwell time and back-dates the stop to when slowing began', () => {
    const readings = [
      { t: 0, speedMps: 3 },
      { t: 1000, speedMps: 0.2 },
      ...Array.from({ length: 10 }, (_, i) => ({ t: 2000 + i * 1000, speedMps: 0.1 })),
    ];
    const { state, changes } = feed(readings);
    expect(changes).toEqual([{ type: 'stopped', at: 1000 }]);
    expect(state.moving).toBe(false);
  });

  it('does not stop for a slowdown shorter than the dwell', () => {
    const { changes } = feed([
      { t: 0, speedMps: 0.2 },
      { t: 5000, speedMps: 0.2 },
      { t: 6000, speedMps: 3 },
      { t: 12_000, speedMps: 0.2 },
    ]);
    expect(changes).toEqual([]);
  });

  it('needs consecutive fast readings to resume, so one spike cannot', () => {
    const stopped: MotionState = { moving: false, slowSince: 0, fastReadings: 0 };
    expect(
      feed(
        [
          { t: 1, speedMps: 4 },
          { t: 2, speedMps: 0 },
          { t: 3, speedMps: 4 },
        ],
        stopped,
      ).changes,
    ).toEqual([]);
    expect(
      feed(
        [
          { t: 1, speedMps: 4 },
          { t: 2, speedMps: 4 },
        ],
        stopped,
      ).changes,
    ).toEqual([{ type: 'resumed', at: 2 }]);
  });

  it('never resumes while every reading is below the resume threshold (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: config.resumeSpeedMps - 0.01, noNaN: true }), {
          maxLength: 60,
        }),
        (speeds) => {
          const stopped: MotionState = { moving: false, slowSince: 0, fastReadings: 0 };
          const { changes } = feed(
            speeds.map((speedMps, i) => ({ t: i * 1000, speedMps })),
            stopped,
          );
          expect(changes).toEqual([]);
        },
      ),
    );
  });

  it('never stops while every reading is at or above the stop threshold (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: config.stopSpeedMps, max: 12, noNaN: true }), { maxLength: 60 }),
        (speeds) => {
          const { changes } = feed(speeds.map((speedMps, i) => ({ t: i * 1000, speedMps })));
          expect(changes).toEqual([]);
        },
      ),
    );
  });
});
