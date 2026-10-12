import { type ActivityType, type Split } from '@/features/tracking/lib/types';

import { type CoachContext, type CoachRun } from '../Coach';

export const NOW = new Date(2026, 9, 14, 18, 0).getTime();
const DAY = 86_400_000;

export function coachRun(
  id: string,
  daysAgo: number,
  km: number,
  paceSecPerKm: number,
  activity: ActivityType = 'run',
  elevationGainM = 12,
): CoachRun {
  const movingMs = km * paceSecPerKm * 1000;
  return {
    id,
    activity,
    startedAt: NOW - daysAgo * DAY - 3_600_000,
    summary: {
      distanceM: km * 1000,
      movingMs,
      elapsedMs: movingMs + 60_000,
      elevationGainM,
      elevationLossM: elevationGainM,
      avgPaceSecPerKm: paceSecPerKm,
      maxSpeedMps: 1000 / (paceSecPerKm * 0.85),
      calories: km * 70,
    },
  };
}

export function splitsFor(paces: readonly number[]): Split[] {
  return paces.map((pace, i) => ({
    index: i + 1,
    distanceM: 1000,
    durationMs: pace * 1000,
    paceSecPerKm: pace,
    elevationDeltaM: 0,
    partial: false,
  }));
}

export function context(
  run: CoachRun,
  splitPaces: readonly number[],
  history: readonly CoachRun[],
  units: 'metric' | 'imperial' = 'metric',
): CoachContext {
  return { run: { ...run, splits: splitsFor(splitPaces) }, history, units, now: NOW };
}

/** A typical recent block: five easy runs around 6:00/km and 6 km. */
export const BASE_HISTORY: CoachRun[] = [
  coachRun('h1', 2, 6, 362),
  coachRun('h2', 5, 5.5, 358),
  coachRun('h3', 9, 6.5, 365),
  coachRun('h4', 12, 6, 360),
  coachRun('h5', 16, 5.8, 363),
];
