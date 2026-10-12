import { haversine } from './geo';
import { type ActivityType, type Fix, type LatLon } from './types';

export type RejectReason = 'stale' | 'poorAccuracy' | 'impossibleSpeed';

export type OutlierLimits = {
  /** Fixes with a worse horizontal accuracy than this are dropped. */
  maxAccuracyM: number;
  /** Faster than this between two fixes is a GPS jump, not the athlete. */
  maxSpeedMps: number;
};

/**
 * Generous on purpose: rejecting a real sprint is worse than letting through a
 * small jump the Kalman filter will damp anyway. 12 m/s is faster than any
 * human has run; 30 m/s is a fast descent on a road bike.
 */
export const OUTLIER_LIMITS: Record<ActivityType, OutlierLimits> = {
  run: { maxAccuracyM: 35, maxSpeedMps: 12 },
  ride: { maxAccuracyM: 35, maxSpeedMps: 30 },
};

/**
 * Decides whether a fix is usable relative to the last accepted position.
 * The speed test subtracts the fix's own uncertainty first, so a slightly
 * wobbly but honest fix taken one second later does not read as 20 m/s.
 */
export function screenFix(
  previous: (LatLon & { t: number }) | null,
  fix: Fix,
  limits: OutlierLimits,
): RejectReason | null {
  if (fix.accuracy !== null && fix.accuracy > limits.maxAccuracyM) return 'poorAccuracy';
  if (!previous) return null;

  const dtSeconds = (fix.t - previous.t) / 1000;
  if (dtSeconds <= 0) return 'stale';

  const distance = haversine(previous, fix);
  const slack = fix.accuracy ?? 0;
  const impliedSpeed = Math.max(0, distance - slack) / dtSeconds;
  return impliedSpeed > limits.maxSpeedMps ? 'impossibleSpeed' : null;
}

/**
 * A run of consecutive "impossible" fixes that agree with each other is the
 * receiver re-acquiring after a tunnel, not noise. Without this the tracker
 * would reject every fix forever after a genuine jump.
 */
export const REANCHOR_AFTER = 3;

export function agreeWithEachOther(fixes: readonly Fix[], limits: OutlierLimits): boolean {
  for (let i = 1; i < fixes.length; i++) {
    const prev = fixes[i - 1]!;
    if (screenFix(prev, fixes[i]!, limits) !== null) return false;
  }
  return fixes.length >= REANCHOR_AFTER;
}
