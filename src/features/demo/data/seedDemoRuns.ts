import { createId } from '@/core/lib/id';
import { type RunRepository } from '@/features/history/data/runRepository';
import { processTrack } from '@/features/recording/lib/processTrack';
import { defaultTitle } from '@/features/tracking/lib/summarize';

import { demoTracks } from '../lib/seedPlan';

/**
 * Fills an empty history with the fictional demo sessions, each processed by
 * the same pipeline a live recording uses. Idempotent: does nothing once any
 * run exists, so it is safe to call on every demo launch.
 */
export async function seedDemoRuns(deps: {
  runs: RunRepository;
  weightKg: number;
  now: number;
}): Promise<number> {
  if ((await deps.runs.count()) > 0) return 0;
  let seeded = 0;
  for (const { plan, fixes } of demoTracks(deps.now)) {
    const processed = processTrack({
      segments: [fixes],
      activity: plan.route.activity,
      autoPause: 'normal',
      weightKg: deps.weightKg,
    });
    if (!processed) continue;
    await deps.runs.insertFinished({
      meta: {
        id: createId(processed.startedAt, seededEntropy(seeded)),
        title: defaultTitle(plan.route.activity, processed.startedAt),
        activity: plan.route.activity,
        source: 'demo',
        autoPause: 'normal',
        startedAt: processed.startedAt,
      },
      endedAt: processed.endedAt,
      summary: processed.summary,
      points: processed.points,
    });
    seeded++;
  }
  return seeded;
}

function seededEntropy(index: number): () => number {
  let state = index + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}
