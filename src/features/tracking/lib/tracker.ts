import {
  autoPauseConfig,
  detectMotion,
  initialMotion,
  type AutoPauseConfig,
  type AutoPauseSensitivity,
  type MotionChange,
  type MotionState,
} from './autoPause';
import { haversine } from './geo';
import { kalmanStep, type KalmanState } from './kalman';
import {
  agreeWithEachOther,
  OUTLIER_LIMITS,
  screenFix,
  type OutlierLimits,
  type RejectReason,
} from './outliers';
import { type ActivityType, type Fix, type TrackPoint } from './types';

export type TrackerConfig = {
  limits: OutlierLimits;
  /** Kalman acceleration noise in m/s²: how sharply the athlete can change speed or direction. */
  accelerationNoise: number;
  autoPause: AutoPauseConfig | null;
};

export function trackerConfig(
  activity: ActivityType,
  sensitivity: AutoPauseSensitivity,
): TrackerConfig {
  return {
    limits: OUTLIER_LIMITS[activity],
    accelerationNoise: activity === 'run' ? 1.5 : 2.5,
    autoPause: autoPauseConfig(activity, sensitivity),
  };
}

type Stamp = { t: number; lat: number; lon: number };

/**
 * Everything the tracker needs to carry between fixes, and nothing that grows
 * with the run: accepted points are returned to the caller, not accumulated
 * here. That keeps each step O(1) and lets a restart rebuild state by folding
 * the stored fixes in one pass.
 */
export type TrackerState = {
  kalman: KalmanState | null;
  last: TrackPoint | null;
  segment: number;
  /** False after a pause: the next accepted point opens a new segment and adds no distance. */
  segmentOpen: boolean;
  /** Consecutive impossible-speed fixes, kept to detect a genuine re-acquisition. */
  suspects: Fix[];
  motion: MotionState;
  /** Filtered positions over the last few seconds, for a speed estimate when the device gives none. */
  window: Stamp[];
  distanceM: number;
  lastFix: { t: number; accuracy: number | null } | null;
};

export const initialTracker: TrackerState = {
  kalman: null,
  last: null,
  segment: 0,
  segmentOpen: false,
  suspects: [],
  motion: initialMotion,
  window: [],
  distanceM: 0,
  lastFix: null,
};

export type TrackerStep = {
  state: TrackerState;
  point: TrackPoint | null;
  rejected: RejectReason | null;
  motion: MotionChange | null;
};

// Long enough that slow multipath drift while standing still averages out
// (it wanders, it does not travel), short enough to notice a stop quickly.
const SPEED_WINDOW_MS = 10_000;

/**
 * Folds one fix into the tracker.
 *
 * `holding` is true while the session is auto-paused: fixes still refine the
 * position and feed the motion detector, but produce no points or distance
 * until the detector says the athlete is moving again.
 */
export function ingestFix(
  state: TrackerState,
  fix: Fix,
  config: TrackerConfig,
  holding: boolean,
): TrackerStep {
  let next: TrackerState = { ...state, lastFix: { t: fix.t, accuracy: fix.accuracy } };

  const reference = next.kalman;
  const verdict = screenFix(reference, fix, config.limits);
  if (verdict === 'stale' || verdict === 'poorAccuracy') {
    return { state: next, point: null, rejected: verdict, motion: null };
  }
  if (verdict === 'impossibleSpeed') {
    const suspects = [...next.suspects, fix];
    if (!agreeWithEachOther(suspects, config.limits)) {
      return { state: { ...next, suspects }, point: null, rejected: verdict, motion: null };
    }
    // The receiver has settled somewhere new. Restart the filter from here and
    // break the line rather than drawing a straight jump across the map.
    next = { ...next, kalman: null, segmentOpen: false, window: [] };
  }
  next = { ...next, suspects: [] };

  const kalman = kalmanStep(next.kalman, fix, config.accelerationNoise);
  const stamp: Stamp = { t: fix.t, lat: kalman.lat, lon: kalman.lon };
  const window = [...next.window, stamp].filter(
    (s, i, all) => i === all.length - 1 || fix.t - s.t <= SPEED_WINDOW_MS,
  );
  next = { ...next, kalman, window };

  let change: MotionChange | null = null;
  const speed = fix.speed !== null && fix.speed >= 0 ? fix.speed : windowSpeed(window);
  if (config.autoPause && speed !== null) {
    const detected = detectMotion(next.motion, { t: fix.t, speedMps: speed }, config.autoPause);
    next = { ...next, motion: detected.state };
    change = detected.change;
  }

  if (holding && change?.type !== 'resumed') {
    return { state: next, point: null, rejected: null, motion: change };
  }
  if (holding) {
    // Coming out of an auto-pause starts a fresh segment, so stationary drift
    // during the stop never shows up as distance.
    next = { ...next, segmentOpen: false };
  }

  const segment = next.segmentOpen ? next.segment : next.last === null ? 0 : next.segment + 1;
  const point: TrackPoint = { t: fix.t, lat: kalman.lat, lon: kalman.lon, alt: fix.alt, segment };
  const added = next.segmentOpen && next.last ? haversine(next.last, point) : 0;

  return {
    state: {
      ...next,
      last: point,
      segment,
      segmentOpen: true,
      distanceM: next.distanceM + added,
    },
    point,
    rejected: null,
    motion: change,
  };
}

/**
 * Ends the current segment, used for manual pauses. The filter is reset too:
 * someone who pauses, walks to a café and resumes should not have their first
 * new fix judged against where they stopped.
 */
export function breakSegment(state: TrackerState): TrackerState {
  return {
    ...state,
    kalman: null,
    segmentOpen: false,
    suspects: [],
    motion: initialMotion,
    window: [],
  };
}

function windowSpeed(window: readonly Stamp[]): number | null {
  if (window.length < 2) return null;
  const first = window[0]!;
  const last = window[window.length - 1]!;
  const dt = (last.t - first.t) / 1000;
  return dt > 0 ? haversine(first, last) / dt : null;
}
