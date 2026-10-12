/**
 * Props for the Live Activity. Everything arrives pre-formatted: the widget
 * runs in an isolated runtime that cannot import the app's unit helpers (see
 * the `'widget'` directive in expo-widgets).
 */
export type RunActivityProps = {
  activity: 'run' | 'ride';
  status: 'recording' | 'paused' | 'autoPaused';
  /**
   * Epoch ms such that "now - timerStart" is the moving time. Lets SwiftUI tick
   * the clock natively between updates. Null when the clock is not real time
   * (a 10x replay), in which case `elapsed` is shown as text.
   */
  timerStart: number | null;
  /** Epoch ms at which the native timer should appear frozen, when not recording. */
  pausedAt: number | null;
  elapsed: string;
  distance: string;
  distanceUnit: string;
  pace: string;
  paceLabel: string;
};
