import { type ActivityType } from './types';

/**
 * Energy estimates. Both are population averages and say so in the UI; without
 * heart rate nothing better is honest.
 *
 * Running: net cost of running is close to 1 kcal per kg per km and nearly
 * independent of pace (Margaria et al., 1963; ACSM's running equation gives
 * the same within a few percent on flat ground). Gross energy, which is what
 * people compare with other apps, adds resting metabolism over the duration
 * (1 MET = 1 kcal/kg/h).
 *
 * Riding: cycling cost depends strongly on speed, so it uses the Compendium of
 * Physical Activities MET values by speed band (Ainsworth et al., 2011):
 * kcal = MET x kg x hours.
 */
const RUN_KCAL_PER_KG_KM = 1.0;
const RESTING_MET = 1.0;

const RIDE_MET_BANDS: readonly { belowKmh: number; met: number }[] = [
  { belowKmh: 16, met: 4.0 },
  { belowKmh: 19.3, met: 6.8 },
  { belowKmh: 22.5, met: 8.0 },
  { belowKmh: 25.7, met: 10.0 },
  { belowKmh: 30.6, met: 12.0 },
  { belowKmh: Infinity, met: 15.8 },
];

export function rideMet(speedKmh: number): number {
  return RIDE_MET_BANDS.find((band) => speedKmh < band.belowKmh)!.met;
}

export function estimateCalories(input: {
  activity: ActivityType;
  distanceM: number;
  movingMs: number;
  weightKg: number;
}): number {
  const { activity, distanceM, movingMs, weightKg } = input;
  if (distanceM <= 0 || movingMs <= 0 || weightKg <= 0) return 0;
  const hours = movingMs / 3_600_000;
  if (activity === 'run') {
    return weightKg * (RUN_KCAL_PER_KG_KM * (distanceM / 1000) + RESTING_MET * hours);
  }
  const speedKmh = distanceM / 1000 / hours;
  return rideMet(speedKmh) * weightKg * hours;
}
