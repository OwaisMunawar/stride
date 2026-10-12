import { type InsightContent, type WorkoutKind } from '../Coach';
import { type CoachFacts } from './facts';

export type NextRunPlan = InsightContent['nextRun'];

/**
 * The next-run suggestion, by rules most coaches would sign off on:
 *
 * - after a hard, long or big-volume-jump session, recover;
 * - weekly volume up more than 10% on last week: hold back (the 10% rule is
 *   crude but it is what keeps beginners uninjured);
 * - a controlled run with even or negative splits earns a tempo session;
 * - a short week with no long run yet gets a long, easy one;
 * - otherwise, easy miles.
 *
 * Targets come from the runner's own recent median, not population tables.
 */
export function planNextRun(facts: CoachFacts): NextRunPlan {
  const baselinePace = facts.recentPaceSecPerKm ?? facts.paceSecPerKm ?? defaultPace(facts);
  const baselineKm = Math.max(
    facts.recentDistanceKm ?? facts.distanceKm,
    facts.activity === 'ride' ? 5 : 2,
  );
  const ride = facts.activity === 'ride';

  const make = (kind: WorkoutKind, distanceKm: number, paceFactor: number, rationale: string) => ({
    kind,
    distanceKm: roundTo(distanceKm, ride ? 5 : 0.5),
    targetPaceSecPerKm: Math.round(baselinePace * paceFactor),
    rationale,
  });

  if (facts.effort === 'hard' || facts.longestRecent) {
    return make(
      'recovery',
      baselineKm * 0.6,
      1.12,
      facts.longestRecent
        ? 'That was your longest effort in six weeks. Keep the next one short and genuinely easy so it pays off.'
        : 'You pushed well past your usual pace. An easy, short session lets your legs absorb it.',
    );
  }
  if (facts.weekChangePct !== null && facts.weekChangePct > 10) {
    return make(
      'easy',
      baselineKm * 0.8,
      1.08,
      `Weekly volume is up ${Math.round(facts.weekChangePct)}% on last week. Hold it there before adding more.`,
    );
  }
  if ((facts.splitTrend === 'negative' || facts.splitTrend === 'even') && facts.recentRuns >= 2) {
    return make(
      'tempo',
      baselineKm * 0.9,
      0.95,
      'Your pacing was controlled. A tempo run at a comfortably hard effort builds on that.',
    );
  }
  if (
    facts.weekDistanceKm < baselineKm * 2 &&
    facts.distanceVsRecentPct !== null &&
    facts.distanceVsRecentPct < 0
  ) {
    return make(
      'long',
      baselineKm * 1.25,
      1.1,
      'This week is light so far. A longer, slower run adds endurance without much strain.',
    );
  }
  return make('easy', baselineKm, 1.05, 'Bank another relaxed session at conversational pace.');
}

function defaultPace(facts: CoachFacts): number {
  return facts.activity === 'ride' ? 150 : 390;
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}
