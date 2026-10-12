import { metresPerDegree } from './geo';
import { type Fix } from './types';

/**
 * A constant-velocity Kalman filter over position, run independently on the
 * east and north axes in local metres, with the measurement noise taken from
 * each fix's reported accuracy.
 *
 * Why constant velocity: a constant-position filter (the common "KalmanLatLong"
 * snippet) trails a moving athlete by several metres at all times, which
 * undercounts distance at every pause and drags the live marker behind the
 * runner. Modelling velocity removes that lag on straight stretches, while
 * the acceleration noise still lets it follow turns and stops within a couple
 * of fixes. Weighting by accuracy does the rest: a 4 m fix moves the estimate
 * almost all the way, a 40 m fix barely at all.
 *
 * The covariance is shared between axes because the measurement noise is
 * isotropic (one accuracy radius) and so is the motion model.
 */
export type KalmanState = {
  lat: number;
  lon: number;
  /** Velocity east and north in m/s. */
  ve: number;
  vn: number;
  /** Covariance [[p00, p01], [p01, p11]] of (position m, velocity m/s), same for both axes. */
  p00: number;
  p01: number;
  p11: number;
  t: number;
};

/** Below this, reported accuracy is optimistic; treat it as this many metres. */
const MIN_ACCURACY_M = 3;
/** Fixes without an accuracy (GPX files, some Android providers) get a typical consumer value. */
const DEFAULT_ACCURACY_M = 10;
/** Initial velocity uncertainty: anything up to ~10 m/s is plausible before we know. */
const INITIAL_VELOCITY_VARIANCE = 100;

export function kalmanStep(
  state: KalmanState | null,
  fix: Pick<Fix, 't' | 'lat' | 'lon' | 'accuracy'>,
  /** White-acceleration noise in m/s²: how sharply the athlete can change speed or direction. */
  accelerationNoise: number,
): KalmanState {
  const accuracy = Math.max(MIN_ACCURACY_M, fix.accuracy ?? DEFAULT_ACCURACY_M);
  const r = accuracy * accuracy;

  if (!state) {
    return {
      lat: fix.lat,
      lon: fix.lon,
      ve: 0,
      vn: 0,
      p00: r,
      p01: 0,
      p11: INITIAL_VELOCITY_VARIANCE,
      t: fix.t,
    };
  }

  const dt = Math.max(0, (fix.t - state.t) / 1000);
  const scale = metresPerDegree(state.lat);
  const q = accelerationNoise * accelerationNoise;

  // Predict: move along the current velocity and grow the uncertainty.
  const predictedLat = state.lat + (state.vn * dt) / scale.lat;
  const predictedLon = state.lon + (state.ve * dt) / scale.lon;
  const p00 = state.p00 + 2 * dt * state.p01 + dt * dt * state.p11 + (q * dt ** 4) / 4;
  const p01 = state.p01 + dt * state.p11 + (q * dt ** 3) / 2;
  const p11 = state.p11 + q * dt * dt;

  // Update with the measured position.
  const s = p00 + r;
  const k0 = p00 / s;
  const k1 = p01 / s;
  const innovationNorth = (fix.lat - predictedLat) * scale.lat;
  const innovationEast = (fix.lon - predictedLon) * scale.lon;

  return {
    lat: predictedLat + (k0 * innovationNorth) / scale.lat,
    lon: predictedLon + (k0 * innovationEast) / scale.lon,
    vn: state.vn + k1 * innovationNorth,
    ve: state.ve + k1 * innovationEast,
    p00: (1 - k0) * p00,
    p01: (1 - k0) * p01,
    p11: p11 - k1 * p01,
    t: fix.t,
  };
}

/** Filtered ground speed in m/s. */
export function kalmanSpeed(state: KalmanState): number {
  return Math.hypot(state.ve, state.vn);
}
