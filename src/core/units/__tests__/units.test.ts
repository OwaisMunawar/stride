import * as fc from 'fast-check';

import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  METRES_PER_MILE,
  metresToUnit,
  paceToUnit,
  paceUnitLabel,
  speedToUnit,
  speedUnitLabel,
  unitLength,
} from '../units';

describe('units', () => {
  it('labels both systems', () => {
    expect([distanceUnitLabel('metric'), distanceUnitLabel('imperial')]).toEqual(['km', 'mi']);
    expect([paceUnitLabel('metric'), paceUnitLabel('imperial')]).toEqual(['/km', '/mi']);
    expect([speedUnitLabel('metric'), speedUnitLabel('imperial')]).toEqual(['km/h', 'mph']);
    expect(unitLength('imperial')).toBe(METRES_PER_MILE);
  });

  it('formats distance by truncating, never rounding up to the next split', () => {
    expect(formatDistance(4999, 'metric')).toBe('4.99');
    expect(formatDistance(5000, 'metric')).toBe('5.00');
    expect(formatDistance(METRES_PER_MILE * 3.1, 'imperial')).toBe('3.10');
    expect(formatDistance(-5, 'metric')).toBe('0.00');
    expect(formatDistance(12_345, 'metric', 1)).toBe('12.3');
  });

  it('formats durations like a watch', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59_999)).toBe('0:59');
    expect(formatDuration(61_000)).toBe('1:01');
    expect(formatDuration(3_600_000 + 5 * 60_000 + 9_000)).toBe('1:05:09');
    expect(formatDuration(-1)).toBe('0:00');
  });

  it('formats pace per unit and hides meaningless values', () => {
    expect(formatPace(300, 'metric')).toBe('5:00');
    expect(formatPace(300, 'imperial')).toBe('8:03');
    expect(formatPace(null, 'metric')).toBe('--:--');
    expect(formatPace(0, 'metric')).toBe('--:--');
    expect(formatPace(Infinity, 'metric')).toBe('--:--');
    expect(formatPace(4000, 'metric')).toBe('--:--');
  });

  it('formats speed and elevation', () => {
    expect(formatSpeed(10, 'metric')).toBe('36.0');
    expect(formatSpeed(10, 'imperial')).toBe('22.4');
    expect(formatSpeed(null, 'metric')).toBe('--');
    expect(formatSpeed(-1, 'metric')).toBe('--');
    expect(formatElevation(100, 'metric')).toBe('100 m');
    expect(formatElevation(100, 'imperial')).toBe('328 ft');
  });

  it('round-trips distance, pace and speed conversions', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e6, noNaN: true }), (metres) => {
        const miles = metresToUnit(metres, 'imperial');
        expect(miles * METRES_PER_MILE).toBeCloseTo(metres, 6);
        const km = metresToUnit(metres, 'metric');
        expect(km * 1000).toBeCloseTo(metres, 6);
      }),
    );
    fc.assert(
      fc.property(fc.double({ min: 120, max: 1200, noNaN: true }), (secPerKm) => {
        // A pace and the speed it implies describe the same motion in either system.
        const mps = 1000 / secPerKm;
        const perMile = paceToUnit(secPerKm, 'imperial');
        expect(METRES_PER_MILE / perMile).toBeCloseTo(mps, 6);
        expect(speedToUnit(mps, 'metric')).toBeCloseTo(3600 / secPerKm, 6);
      }),
    );
  });
});
