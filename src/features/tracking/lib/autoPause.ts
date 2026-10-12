import { type ActivityType } from './types';

export type AutoPauseSensitivity = 'off' | 'low' | 'normal' | 'high';

export type AutoPauseConfig = {
  /** Below this speed the athlete counts as stopped... */
  stopSpeedMps: number;
  /** ...once they have stayed below it for this long. */
  dwellMs: number;
  /** Above this speed (higher than stop, for hysteresis) they are moving again. */
  resumeSpeedMps: number;
  /** Consecutive fast readings needed to resume, so one GPS jump cannot. */
  resumeReadings: number;
};

/**
 * Walking pace is about 1.4 m/s, so "normal" pauses a runner who has slowed to
 * a shuffle at a crossing but not one walking up a steep hill. Riders get
 * proportionally higher thresholds because a track stand is not riding.
 */
const RUN_PRESETS: Record<Exclude<AutoPauseSensitivity, 'off'>, AutoPauseConfig> = {
  low: { stopSpeedMps: 0.5, dwellMs: 12_000, resumeSpeedMps: 1.2, resumeReadings: 3 },
  normal: { stopSpeedMps: 0.8, dwellMs: 8_000, resumeSpeedMps: 1.5, resumeReadings: 2 },
  high: { stopSpeedMps: 1.1, dwellMs: 5_000, resumeSpeedMps: 1.8, resumeReadings: 2 },
};

const RIDE_FACTOR = 2.5;

export function autoPauseConfig(
  activity: ActivityType,
  sensitivity: AutoPauseSensitivity,
): AutoPauseConfig | null {
  if (sensitivity === 'off') return null;
  const preset = RUN_PRESETS[sensitivity];
  if (activity === 'run') return preset;
  return {
    ...preset,
    stopSpeedMps: preset.stopSpeedMps * RIDE_FACTOR,
    resumeSpeedMps: preset.resumeSpeedMps * RIDE_FACTOR,
  };
}

export type MotionState = {
  moving: boolean;
  /** When speed first dropped below the stop threshold in the current slow stretch. */
  slowSince: number | null;
  fastReadings: number;
};

export const initialMotion: MotionState = { moving: true, slowSince: null, fastReadings: 0 };

export type MotionChange = { type: 'stopped'; at: number } | { type: 'resumed'; at: number };

/**
 * Pure detector: feed it (time, speed) readings and it reports transitions.
 * A stop is back-dated to when the slowdown began, so the dwell time is not
 * counted as moving time.
 */
export function detectMotion(
  state: MotionState,
  reading: { t: number; speedMps: number },
  config: AutoPauseConfig,
): { state: MotionState; change: MotionChange | null } {
  if (state.moving) {
    if (reading.speedMps >= config.stopSpeedMps) {
      return { state: { ...state, slowSince: null }, change: null };
    }
    const slowSince = state.slowSince ?? reading.t;
    if (reading.t - slowSince >= config.dwellMs) {
      return {
        state: { moving: false, slowSince, fastReadings: 0 },
        change: { type: 'stopped', at: slowSince },
      };
    }
    return { state: { ...state, slowSince }, change: null };
  }

  if (reading.speedMps < config.resumeSpeedMps) {
    return { state: { ...state, fastReadings: 0 }, change: null };
  }
  const fastReadings = state.fastReadings + 1;
  if (fastReadings >= config.resumeReadings) {
    return {
      state: { moving: true, slowSince: null, fastReadings: 0 },
      change: { type: 'resumed', at: reading.t },
    };
  }
  return { state: { ...state, fastReadings }, change: null };
}
