import { AppError } from '@/core/errors/AppError';

import { insightSchema, type InsightContent } from '../Coach';
import { type CoachFacts } from './facts';
import { type NextRunPlan } from './plan';

/**
 * Validates and bounds what a language model returns. Schema failures are
 * errors (the caller falls back to rules); out-of-range numbers are clamped
 * to the rule-based plan's neighbourhood, because "run 42 km tomorrow at 3:00"
 * is the kind of confident nonsense a small model will occasionally produce.
 */
export function guardInsight(
  raw: unknown,
  facts: CoachFacts,
  baseline: NextRunPlan,
): InsightContent {
  const parsed = insightSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'COACH_INVALID_OUTPUT',
      parsed.error.issues[0]?.message ?? 'Invalid insight',
      {
        cause: parsed.error,
      },
    );
  }
  const content = parsed.data;
  const maxKm = Math.max(baseline.distanceKm * 1.5, facts.distanceKm * 1.2);
  const minKm = Math.min(baseline.distanceKm * 0.5, facts.distanceKm);
  return {
    summary: content.summary,
    highlights: content.highlights.slice(0, 4),
    nextRun: {
      ...content.nextRun,
      distanceKm: clamp(round1(content.nextRun.distanceKm), Math.max(0.5, minKm), maxKm),
      targetPaceSecPerKm: Math.round(
        clamp(
          content.nextRun.targetPaceSecPerKm,
          baseline.targetPaceSecPerKm * 0.85,
          baseline.targetPaceSecPerKm * 1.2,
        ),
      ),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
