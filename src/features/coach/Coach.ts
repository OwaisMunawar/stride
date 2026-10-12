import { z } from 'zod';

import { type UnitSystem } from '@/core/units/units';
import { type RunSummary } from '@/features/tracking/lib/summarize';
import { type ActivityType, type Split } from '@/features/tracking/lib/types';

export type CoachProviderId = 'rules' | 'onDevice' | 'server';

export const workoutKinds = ['recovery', 'easy', 'long', 'tempo', 'intervals'] as const;
export type WorkoutKind = (typeof workoutKinds)[number];

/**
 * The structured output every coach must produce. The same schema validates a
 * rule-based result, an on-device model result and a server result, so the
 * UI never has to know which one wrote it.
 */
export const insightSchema = z.object({
  summary: z.string().trim().min(1).max(400),
  highlights: z.array(z.string().trim().min(1).max(160)).min(1).max(4),
  nextRun: z.object({
    kind: z.enum(workoutKinds),
    distanceKm: z.number().min(0.5).max(200),
    targetPaceSecPerKm: z.number().min(60).max(1200),
    rationale: z.string().trim().min(1).max(280),
  }),
});

export type InsightContent = z.infer<typeof insightSchema>;

export type RunInsight = InsightContent & {
  /** Which coach actually produced it, after any fallback. */
  provider: CoachProviderId;
  generatedAt: number;
  /** Set when the chosen coach could not answer and the rule-based one did. */
  fallbackReason?: string;
};

export type CoachRun = {
  id: string;
  activity: ActivityType;
  startedAt: number;
  summary: Omit<RunSummary, 'bounds'>;
};

export type CoachContext = {
  run: CoachRun & { splits: readonly Split[] };
  /** Earlier finished runs, newest first. The coach decides how far back to look. */
  history: readonly CoachRun[];
  units: UnitSystem;
  now: number;
};

export interface Coach {
  readonly id: CoachProviderId;
  /** Cheap check, safe to call when rendering settings. */
  isAvailable(): Promise<boolean>;
  analyze(context: CoachContext): Promise<RunInsight>;
}
