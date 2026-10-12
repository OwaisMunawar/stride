import { type Fix } from '@/features/tracking/lib/types';

import { type FixSink, type LocationSource } from './LocationSource';

export type Scheduler = {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

const realScheduler: Scheduler = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/**
 * Replays a recorded track as if it were happening now, `rate` times faster.
 *
 * Fix timestamps keep their original spacing on a virtual clock that starts
 * at the moment of `start()`. Compressing the timestamps instead would make
 * every fix look ten times faster than the athlete and the outlier gate would
 * (correctly) throw them all away.
 */
export function createReplayLocationSource(options: {
  track: readonly Fix[];
  rate?: number;
  tickMs?: number;
  wallClock?: () => number;
  scheduler?: Scheduler;
  onFinished?: () => void;
}): LocationSource {
  const rate = options.rate ?? 10;
  const tickMs = options.tickMs ?? 250;
  const wallClock = options.wallClock ?? Date.now;
  const scheduler = options.scheduler ?? realScheduler;
  const track = [...options.track].sort((a, b) => a.t - b.t);
  const trackStart = track[0]?.t ?? 0;

  let handle: unknown = null;
  let started = false;
  let wallStart = 0;
  let virtualStart = 0;
  let cursor = 0;
  let finished = false;

  // Before start the clock is the wall clock; once stopped it carries on at
  // real speed from wherever the replay had got to.
  const now = () => {
    if (!started) return wallClock();
    return virtualStart + (wallClock() - wallStart) * (handle === null ? 1 : rate);
  };

  return {
    kind: 'replay',
    rate,
    now,
    async start(sink: FixSink) {
      if (handle !== null) return;
      wallStart = wallClock();
      virtualStart = wallStart;
      cursor = 0;
      finished = false;
      started = true;
      handle = scheduler.setInterval(() => {
        const elapsed = now() - virtualStart;
        const due: Fix[] = [];
        while (cursor < track.length && track[cursor]!.t - trackStart <= elapsed) {
          const fix = track[cursor]!;
          due.push({ ...fix, t: Math.round(virtualStart + (fix.t - trackStart)) });
          cursor++;
        }
        if (due.length > 0) void sink(due);
        if (cursor >= track.length && !finished) {
          finished = true;
          options.onFinished?.();
        }
      }, tickMs);
    },
    async stop() {
      if (handle === null) return;
      const frozen = now();
      scheduler.clearInterval(handle);
      handle = null;
      virtualStart = frozen;
      wallStart = wallClock();
    },
  };
}
