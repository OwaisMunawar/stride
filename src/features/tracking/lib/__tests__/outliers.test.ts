import * as fc from 'fast-check';

import { ORIGIN, straightFixes } from '@/test-utils/tracks';

import { offset } from '../geo';
import { agreeWithEachOther, OUTLIER_LIMITS, REANCHOR_AFTER, screenFix } from '../outliers';
import { type Fix } from '../types';

const limits = OUTLIER_LIMITS.run;
const fixAt = (t: number, eastM: number, accuracy: number | null = 5): Fix => ({
  t,
  ...offset(ORIGIN, eastM, 0),
  alt: null,
  accuracy,
  altitudeAccuracy: null,
  speed: null,
});

describe('screenFix', () => {
  it('accepts the first fix unless its accuracy is poor', () => {
    expect(screenFix(null, fixAt(0, 0), limits)).toBeNull();
    expect(screenFix(null, fixAt(0, 0, 80), limits)).toBe('poorAccuracy');
  });

  it('rejects fixes that do not move time forward', () => {
    const previous = { t: 1000, ...ORIGIN };
    expect(screenFix(previous, fixAt(1000, 1), limits)).toBe('stale');
    expect(screenFix(previous, fixAt(500, 1), limits)).toBe('stale');
  });

  it('rejects physically impossible jumps but allows a sprint', () => {
    const previous = { t: 0, ...ORIGIN };
    expect(screenFix(previous, fixAt(1000, 10), limits)).toBeNull();
    expect(screenFix(previous, fixAt(1000, 80), limits)).toBe('impossibleSpeed');
    expect(screenFix(previous, fixAt(1000, 80), OUTLIER_LIMITS.ride)).toBe('impossibleSpeed');
    expect(screenFix(previous, fixAt(1000, 25), OUTLIER_LIMITS.ride)).toBeNull();
  });

  it('gives a fix the benefit of its own uncertainty', () => {
    const previous = { t: 0, ...ORIGIN };
    // 20 m in one second is 20 m/s, but with 10 m of uncertainty it might be 10.
    expect(screenFix(previous, fixAt(1000, 20, 10), limits)).toBeNull();
    expect(screenFix(previous, fixAt(1000, 20, 2), limits)).toBe('impossibleSpeed');
  });

  it('never rejects a constant-speed track below the limit (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: limits.maxSpeedMps - 0.5, noNaN: true }),
        fc.integer({ min: 0, max: 359 }),
        (speedMps, bearingDeg) => {
          const fixes = straightFixes({ speedMps, seconds: 20, bearingDeg, accuracy: 5 });
          for (let i = 1; i < fixes.length; i++) {
            expect(screenFix(fixes[i - 1]!, fixes[i]!, limits)).toBeNull();
          }
        },
      ),
    );
  });
});

describe('agreeWithEachOther', () => {
  it('needs enough mutually consistent fixes', () => {
    const settled = [fixAt(0, 500), fixAt(1000, 503), fixAt(2000, 506)];
    expect(settled).toHaveLength(REANCHOR_AFTER);
    expect(agreeWithEachOther(settled, limits)).toBe(true);
    expect(agreeWithEachOther(settled.slice(0, 2), limits)).toBe(false);
    expect(agreeWithEachOther([fixAt(0, 500), fixAt(1000, -400), fixAt(2000, 503)], limits)).toBe(
      false,
    );
  });
});
