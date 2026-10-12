import { ORIGIN, pathLength, stationaryFixes, straightFixes } from '@/test-utils/tracks';

import { haversine, offset } from '../geo';
import { kalmanSpeed, kalmanStep, type KalmanState } from '../kalman';

function fold(fixes: Parameters<typeof kalmanStep>[1][], noise = 1.5) {
  let state: KalmanState | null = null;
  for (const fix of fixes) state = kalmanStep(state, fix, noise);
  return state!;
}

describe('kalmanStep', () => {
  it('starts at the first fix with its accuracy as uncertainty and no velocity', () => {
    const state = kalmanStep(null, { t: 0, lat: 1, lon: 2, accuracy: 8 }, 1.5);
    expect(state).toMatchObject({ lat: 1, lon: 2, ve: 0, vn: 0, p00: 64, t: 0 });
  });

  it('trusts accurate fixes more than inaccurate ones', () => {
    const start = kalmanStep(null, { t: 0, ...ORIGIN, accuracy: 5 }, 1.5);
    const target = offset(ORIGIN, 20, 0);
    const precise = kalmanStep(start, { t: 1000, ...target, accuracy: 3 }, 1.5);
    const vague = kalmanStep(start, { t: 1000, ...target, accuracy: 40 }, 1.5);
    expect(haversine(precise, target)).toBeLessThan(haversine(vague, target));
    expect(haversine(vague, ORIGIN)).toBeLessThan(5);
  });

  it('defaults missing accuracy and clamps optimistic values', () => {
    expect(kalmanStep(null, { t: 0, lat: 0, lon: 0, accuracy: null }, 1).p00).toBe(100);
    expect(kalmanStep(null, { t: 0, lat: 0, lon: 0, accuracy: 0.5 }, 1).p00).toBe(9);
  });

  it('learns the velocity and does not lag a steadily moving athlete', () => {
    const fixes = straightFixes({ speedMps: 3.5, seconds: 60, bearingDeg: 45 });
    const state = fold(fixes);
    expect(kalmanSpeed(state)).toBeCloseTo(3.5, 1);
    expect(haversine(state, fixes.at(-1)!)).toBeLessThan(0.5);
  });

  it('damps jitter while standing still', () => {
    // Slow, correlated drift is indistinguishable from slow walking for any
    // filter; that is what auto-pause is for. The filter still removes the
    // fast part of the noise.
    const noisy = straightFixes({ speedMps: 0, seconds: 120, jitterM: 6, accuracy: 10 });
    let state: KalmanState | null = null;
    let filteredPath = 0;
    for (const fix of noisy) {
      const next = kalmanStep(state, fix, 1.5);
      if (state) filteredPath += haversine(state, next);
      state = next;
    }
    expect(filteredPath).toBeLessThan(pathLength(noisy) * 0.7);
  });

  it('regains trust after a long gap', () => {
    const settled = fold(stationaryFixes(ORIGIN, 0, 30));
    const jumped = offset(ORIGIN, 500, 0);
    const after = kalmanStep(settled, { t: 600_000, ...jumped, accuracy: 5 }, 1.5);
    expect(haversine(after, jumped)).toBeLessThan(5);
  });

  it('does not extrapolate when time goes backwards', () => {
    const start = fold(straightFixes({ speedMps: 3, seconds: 10 }));
    const next = kalmanStep(
      start,
      { t: start.t - 5000, lat: start.lat, lon: start.lon, accuracy: 5 },
      1.5,
    );
    expect(haversine(next, start)).toBeLessThan(0.5);
  });
});
