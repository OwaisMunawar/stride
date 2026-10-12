import { isAppError } from '@/core/errors/AppError';
import { unitLength, type UnitSystem } from '@/core/units/units';
import { type RunRepository } from '@/features/history/data/runRepository';
import { type RunRecord } from '@/features/history/model';
import { computeSplits } from '@/features/tracking/lib/splits';

import { type Coach, type CoachContext, type CoachProviderId, type RunInsight } from '../Coach';
import { type InsightRepository } from '../data/insightRepository';
import { ruleInsight } from '../lib/ruleCoach';

export type CoachService = ReturnType<typeof createCoachService>;

/**
 * Picks the coach the user chose, falls back to the rule-based one on any
 * failure, and caches the result per run. The fallback is recorded on the
 * insight so the card can say which coach actually wrote it.
 */
export function createCoachService(deps: {
  coaches: Record<CoachProviderId, Coach>;
  runs: RunRepository;
  insights: InsightRepository;
  preferred: () => CoachProviderId;
  units: () => UnitSystem;
  now?: () => number;
}) {
  const now = deps.now ?? Date.now;

  const buildContext = async (run: RunRecord): Promise<CoachContext> => {
    const [points, history] = await Promise.all([deps.runs.points(run.id), deps.runs.list()]);
    return {
      run: { ...run, splits: computeSplits(points, unitLength(deps.units())) },
      history: history.filter((r) => r.id !== run.id),
      units: deps.units(),
      now: now(),
    };
  };

  const generate = async (runId: string): Promise<RunInsight> => {
    const run = await deps.runs.get(runId);
    const context = await buildContext(run);
    const preferred = deps.coaches[deps.preferred()];
    let insight: RunInsight;
    if (preferred.id === 'rules') {
      insight = ruleInsight(context);
    } else {
      try {
        insight = await preferred.analyze(context);
      } catch (error) {
        insight = {
          ...ruleInsight(context),
          fallbackReason: isAppError(error) ? error.code : 'COACH_FAILED',
        };
      }
    }
    await deps.insights.save(runId, insight);
    return insight;
  };

  return {
    /** Cached insight if there is one, otherwise generates and stores it. */
    async insightFor(runId: string): Promise<RunInsight> {
      return (await deps.insights.get(runId)) ?? generate(runId);
    },
    regenerate: generate,
    async availability(): Promise<Record<CoachProviderId, boolean>> {
      const entries = await Promise.all(
        Object.values(deps.coaches).map(
          async (coach) => [coach.id, await coach.isAvailable()] as const,
        ),
      );
      return Object.fromEntries(entries) as Record<CoachProviderId, boolean>;
    },
  };
}
