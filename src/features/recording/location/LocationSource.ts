import { type Fix } from '@/features/tracking/lib/types';

/** Where fixes go: in the app this persists them to SQLite and wakes the engine. */
export type FixSink = (fixes: readonly Fix[]) => Promise<void>;

/**
 * A producer of location fixes. Two implementations:
 *
 * - device: the OS location service via a background task, which keeps
 *   delivering while the phone is locked;
 * - replay: a GPX track re-timed to the present and played at a multiple of
 *   real time, for the demo and for testing without going outside.
 *
 * Both deliver into the same FixSink, so everything downstream (storage,
 * filtering, state machine, Live Activity) is identical for either.
 */
export interface LocationSource {
  readonly kind: 'device' | 'replay';
  /**
   * The source's clock. Real time for the device; for a replay it runs at the
   * replay speed, so commands like Pause are stamped on the same timeline as
   * the fixes and moving time stays consistent with distance.
   */
  now(): number;
  /** How fast `now()` advances relative to the wall clock. */
  readonly rate: number;
  start(sink: FixSink): Promise<void>;
  stop(): Promise<void>;
}
