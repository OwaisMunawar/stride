import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
  paceUnitLabel,
  speedUnitLabel,
  type UnitSystem,
} from '@/core/units/units';
import { paceSecPerKm, rollingPace } from '@/features/tracking/lib/pace';
import { type ActivityType, type TrackPoint } from '@/features/tracking/lib/types';

import { type RunActivityProps } from '../live-activity/types';
import { movingMsAt, type SessionState } from './session';

export type LiveStats = {
  movingMs: number;
  distanceM: number;
  currentPaceSecPerKm: number | null;
  avgPaceSecPerKm: number | null;
};

export function liveStats(
  session: SessionState,
  points: readonly TrackPoint[],
  now: number,
): LiveStats {
  const movingMs = movingMsAt(session, now);
  const distanceM = session.tracker.distanceM;
  return {
    movingMs,
    distanceM,
    // No "current" pace while stopped: showing the last running pace on a
    // paused screen reads as if the clock were still going.
    currentPaceSecPerKm: session.status === 'recording' ? rollingPace(points) : null,
    avgPaceSecPerKm: paceSecPerKm(distanceM, movingMs),
  };
}

/**
 * Riders think in speed, runners in pace. One formatter so the live screen,
 * the Live Activity and the history agree on which one to show.
 */
export function primaryRate(
  activity: ActivityType,
  paceSecPerKmValue: number | null,
  units: UnitSystem,
): { value: string; label: string } {
  if (activity === 'ride') {
    const mps = paceSecPerKmValue ? 1000 / paceSecPerKmValue : null;
    return { value: formatSpeed(mps, units), label: speedUnitLabel(units) };
  }
  return { value: formatPace(paceSecPerKmValue, units), label: paceUnitLabel(units) };
}

export function activityProps(input: {
  activity: ActivityType;
  session: SessionState;
  stats: LiveStats;
  units: UnitSystem;
  /** Source clock rate; the native timer is only used when it is real time. */
  clockRate: number;
  wallNow: number;
}): RunActivityProps | null {
  const { session, stats, units, activity } = input;
  if (
    session.status !== 'recording' &&
    session.status !== 'paused' &&
    session.status !== 'autoPaused'
  ) {
    return null;
  }
  const realTime = input.clockRate === 1;
  const rate = primaryRate(activity, stats.currentPaceSecPerKm ?? stats.avgPaceSecPerKm, units);
  return {
    activity,
    status: session.status,
    timerStart: realTime ? input.wallNow - stats.movingMs : null,
    pausedAt: realTime && session.status !== 'recording' ? input.wallNow : null,
    elapsed: formatDuration(stats.movingMs),
    distance: formatDistance(stats.distanceM, units),
    distanceUnit: distanceUnitLabel(units),
    pace: rate.value,
    paceLabel: rate.label,
  };
}
