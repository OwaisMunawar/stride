import { type AutoPauseSensitivity } from '@/features/tracking/lib/autoPause';
import { summarizeRun, type RunSummary } from '@/features/tracking/lib/summarize';
import { trackerConfig } from '@/features/tracking/lib/tracker';
import { type ActivityType, type Fix, type TrackPoint } from '@/features/tracking/lib/types';

import { movingMsAt, replaySession, type SessionInput } from './session';

export type ProcessedTrack = {
  points: TrackPoint[];
  summary: RunSummary;
  startedAt: number;
  endedAt: number;
};

/**
 * Runs an already-recorded track through the exact pipeline a live recording
 * uses (outlier gate, Kalman filter, auto-pause, state machine). Segment
 * breaks in the source become pause/resume commands. Imports and demo runs
 * therefore look, measure and split exactly like recorded ones.
 */
export function processTrack(input: {
  segments: readonly (readonly Fix[])[];
  activity: ActivityType;
  autoPause: AutoPauseSensitivity;
  weightKg: number;
}): ProcessedTrack | null {
  const segments = input.segments.filter((s) => s.length > 0);
  const first = segments[0]?.[0];
  const lastSegment = segments[segments.length - 1];
  const last = lastSegment?.[lastSegment.length - 1];
  if (!first || !last) return null;

  const inputs: SessionInput[] = [{ type: 'command', command: 'start', at: first.t }];
  segments.forEach((segment, index) => {
    if (index > 0) {
      const previous = segments[index - 1]!;
      inputs.push({ type: 'command', command: 'pause', at: previous[previous.length - 1]!.t + 1 });
      inputs.push({ type: 'command', command: 'resume', at: segment[0]!.t });
    }
    for (const fix of segment) inputs.push({ type: 'fix', fix });
  });
  inputs.push({ type: 'command', command: 'stop', at: last.t });

  const config = { tracker: trackerConfig(input.activity, input.autoPause), splitUnitM: 1000 };
  const { state, points } = replaySession(inputs, config);
  const summary = summarizeRun({
    points,
    activity: input.activity,
    weightKg: input.weightKg,
    startedAt: first.t,
    endedAt: last.t,
    movingMs: movingMsAt(state, last.t),
  });
  return { points, summary, startedAt: first.t, endedAt: last.t };
}
