import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  paceUnitLabel,
  type UnitSystem,
} from '@/core/units/units';

import { type Coach, type CoachContext, type InsightContent, type RunInsight } from '../Coach';
import { computeFacts, type CoachFacts } from './facts';
import { planNextRun } from './plan';

/**
 * The default coach, and the fallback for the others. Deterministic: the same
 * history always gives the same words, which is also what makes the demo and
 * the screenshot tests stable.
 */
export function createRuleCoach(): Coach {
  return {
    id: 'rules',
    isAvailable: async () => true,
    analyze: async (context) => ruleInsight(context),
  };
}

export function ruleInsight(context: CoachContext, facts = computeFacts(context)): RunInsight {
  return { ...ruleContent(context, facts), provider: 'rules', generatedAt: context.now };
}

export function ruleContent(context: CoachContext, facts: CoachFacts): InsightContent {
  const { units } = context;
  return {
    summary: summarise(context, facts),
    highlights: highlights(facts, units),
    nextRun: planNextRun(facts),
  };
}

function summarise(context: CoachContext, facts: CoachFacts): string {
  const { units, run } = context;
  const noun = facts.activity === 'ride' ? 'ride' : 'run';
  const distance = `${formatDistance(run.summary.distanceM, units)} ${distanceUnitLabel(units)}`;
  const opening = `${capitalise(distance)} ${noun} in ${formatDuration(run.summary.movingMs)} at ${pace(facts.paceSecPerKm, units)}.`;

  const pacing =
    facts.splitTrend === 'negative'
      ? 'You finished faster than you started, which is the hardest pacing to get right.'
      : facts.splitTrend === 'positive'
        ? 'You slowed in the second half, so the opening was probably a touch quick.'
        : facts.splitTrend === 'even'
          ? 'Your pacing stayed remarkably even.'
          : '';

  const comparison =
    facts.paceVsRecentPct === null
      ? 'Log a few more and comparisons with your recent form will show up here.'
      : Math.abs(facts.paceVsRecentPct) < 2
        ? 'Right in line with your recent pace.'
        : facts.paceVsRecentPct < 0
          ? `About ${Math.round(-facts.paceVsRecentPct)}% quicker than your recent average.`
          : `About ${Math.round(facts.paceVsRecentPct)}% easier than your recent average.`;

  return [opening, pacing, comparison].filter(Boolean).join(' ');
}

function highlights(facts: CoachFacts, units: UnitSystem): string[] {
  const list: string[] = [];
  const unit = units === 'metric' ? 'km' : 'mile';
  if (facts.fastestRecent && facts.recentRuns >= 2) {
    list.push('Fastest average pace at this distance in the last six weeks.');
  }
  if (facts.longestRecent) list.push('Longest session in the last six weeks.');
  if (facts.fastestSplit && facts.splitCount >= 2) {
    list.push(
      `Quickest split: ${unit} ${facts.fastestSplit.index} at ${pace(facts.fastestSplit.paceSecPerKm, units)}.`,
    );
  }
  if (facts.paceVariabilityPct !== null && facts.paceVariabilityPct < 3 && facts.splitCount >= 3) {
    list.push(`Splits within ${facts.paceVariabilityPct.toFixed(1)}% of each other.`);
  }
  if (facts.elevationGainM >= 40) {
    list.push(`${formatElevation(facts.elevationGainM, units)} of climbing.`);
  }
  if (facts.streakDays >= 3)
    list.push(`${facts.streakDays}-day streak. Keep it honest with easy days.`);
  if (list.length < 4) {
    const week = `${formatDistance(facts.weekDistanceKm * 1000, units, 1)} ${distanceUnitLabel(units)}`;
    const sessions = `${facts.runsLast7Days} ${facts.runsLast7Days === 1 ? 'session' : 'sessions'}`;
    list.push(`${week} so far this week; ${sessions} in the last 7 days.`);
  }
  return list.slice(0, 4);
}

function pace(secPerKm: number | null, units: UnitSystem): string {
  return `${formatPace(secPerKm, units)} ${paceUnitLabel(units)}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
