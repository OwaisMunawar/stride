import { estimateCalories } from './calories';
import { elevationChange } from './elevation';
import { boundsOf } from './geo';
import { paceSeries, paceSecPerKm } from './pace';
import { movingTimeMs, trackDistance } from './splits';
import { type ActivityType, type Bounds, type TrackPoint } from './types';

export type RunSummary = {
  distanceM: number;
  movingMs: number;
  elapsedMs: number;
  elevationGainM: number;
  elevationLossM: number;
  avgPaceSecPerKm: number | null;
  /** From 100 m buckets, so a single GPS spike cannot set it. */
  maxSpeedMps: number;
  calories: number;
  bounds: Bounds | null;
};

export function summarizeRun(input: {
  points: readonly TrackPoint[];
  activity: ActivityType;
  weightKg: number;
  startedAt: number;
  endedAt: number;
  /**
   * Moving time from the recording state machine when there is one. It ticks
   * with the clock rather than with fixes, so it matches what the live screen
   * showed; imports fall back to time inside track segments.
   */
  movingMs?: number;
}): RunSummary {
  const { points, activity, weightKg, startedAt, endedAt } = input;
  const distanceM = trackDistance(points);
  const movingMs = input.movingMs ?? movingTimeMs(points);
  const { gainM, lossM } = elevationChange(points);
  const fastestBucket = paceSeries(points, 100, 0).reduce(
    (best, s) => Math.min(best, s.paceSecPerKm),
    Infinity,
  );

  return {
    distanceM,
    movingMs,
    elapsedMs: Math.max(0, endedAt - startedAt),
    elevationGainM: gainM,
    elevationLossM: lossM,
    avgPaceSecPerKm: paceSecPerKm(distanceM, movingMs),
    maxSpeedMps: Number.isFinite(fastestBucket) && fastestBucket > 0 ? 1000 / fastestBucket : 0,
    calories: estimateCalories({ activity, distanceM, movingMs, weightKg }),
    bounds: boundsOf(points),
  };
}

/** "Morning Run", "Evening Ride": what every tracker defaults to, because it works. */
export function defaultTitle(activity: ActivityType, startedAt: number): string {
  const hour = new Date(startedAt).getHours();
  const part =
    hour < 5
      ? 'Night'
      : hour < 12
        ? 'Morning'
        : hour < 17
          ? 'Afternoon'
          : hour < 21
            ? 'Evening'
            : 'Night';
  return `${part} ${activity === 'run' ? 'Run' : 'Ride'}`;
}
