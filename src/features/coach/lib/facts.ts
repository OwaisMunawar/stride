import { currentStreak, previousWeekDistance, weekTotals } from '@/features/history/lib/weekly';
import { type ActivityType, type Split } from '@/features/tracking/lib/types';

import { type CoachContext, type CoachRun } from '../Coach';

/**
 * Numbers about a run and its context, computed deterministically. Every
 * coach starts from these: the rule-based coach turns them into sentences, the
 * language-model coaches are asked to write *about* them. A model can phrase
 * things badly; it cannot get the arithmetic wrong, because it never does any.
 */
export type CoachFacts = {
  activity: ActivityType;
  distanceKm: number;
  movingMinutes: number;
  paceSecPerKm: number | null;
  elevationGainM: number;
  splitCount: number;
  /** Second half against first half of the full splits. */
  splitTrend: 'negative' | 'even' | 'positive' | null;
  fastestSplit: { index: number; paceSecPerKm: number } | null;
  /** Coefficient of variation of full-split paces, in percent. */
  paceVariabilityPct: number | null;
  /** This run's pace against the median of recent runs; negative is faster. */
  paceVsRecentPct: number | null;
  distanceVsRecentPct: number | null;
  longestRecent: boolean;
  fastestRecent: boolean;
  recentRuns: number;
  recentPaceSecPerKm: number | null;
  recentDistanceKm: number | null;
  weekDistanceKm: number;
  lastWeekDistanceKm: number;
  weekChangePct: number | null;
  runsLast7Days: number;
  streakDays: number;
  effort: 'easy' | 'moderate' | 'hard';
};

const RECENT_WINDOW_DAYS = 42;
const DAY_MS = 86_400_000;

export function computeFacts(context: CoachContext): CoachFacts {
  const { run, now } = context;
  const recent = context.history.filter(
    (r) =>
      r.id !== run.id &&
      r.activity === run.activity &&
      r.summary.distanceM > 200 &&
      run.startedAt - r.startedAt <= RECENT_WINDOW_DAYS * DAY_MS &&
      r.startedAt < run.startedAt,
  );
  const all = [run, ...context.history.filter((r) => r.id !== run.id)];
  const sameActivity = all.filter((r) => r.activity === run.activity);

  const pace = run.summary.avgPaceSecPerKm;
  const recentPace = median(recent.map((r) => r.summary.avgPaceSecPerKm).filter(isNumber));
  const recentDistance = median(recent.map((r) => r.summary.distanceM));
  const paceVsRecentPct = pace !== null && recentPace !== null ? percent(pace, recentPace) : null;
  const distanceVsRecentPct =
    recentDistance !== null && recentDistance > 0
      ? percent(run.summary.distanceM, recentDistance)
      : null;

  const full = run.splits.filter((s) => !s.partial);
  const week = weekTotals(sameActivity.map(toRunLike), now);
  const lastWeek = previousWeekDistance(sameActivity.map(toRunLike), now);
  const longestRecent =
    recent.length > 0 && recent.every((r) => r.summary.distanceM < run.summary.distanceM);
  const fastestRecent =
    pace !== null &&
    recent.length > 0 &&
    recent
      .filter((r) => r.summary.distanceM >= run.summary.distanceM * 0.8)
      .every((r) => (r.summary.avgPaceSecPerKm ?? Infinity) > pace);

  return {
    activity: run.activity,
    distanceKm: run.summary.distanceM / 1000,
    movingMinutes: run.summary.movingMs / 60_000,
    paceSecPerKm: pace,
    elevationGainM: run.summary.elevationGainM,
    splitCount: full.length,
    splitTrend: splitTrend(full),
    fastestSplit: fastest(full),
    paceVariabilityPct: variability(full),
    paceVsRecentPct,
    distanceVsRecentPct,
    longestRecent,
    fastestRecent,
    recentRuns: recent.length,
    recentPaceSecPerKm: recentPace,
    recentDistanceKm: recentDistance !== null ? recentDistance / 1000 : null,
    weekDistanceKm: week.distanceM / 1000,
    lastWeekDistanceKm: lastWeek / 1000,
    weekChangePct: lastWeek > 0 ? percent(week.distanceM, lastWeek) : null,
    runsLast7Days: sameActivity.filter((r) => now - r.startedAt < 7 * DAY_MS).length,
    streakDays: currentStreak(all.map(toRunLike), now),
    effort: effortOf(paceVsRecentPct, distanceVsRecentPct),
  };
}

/**
 * Hard means notably faster or longer than usual; easy means notably slower.
 * Thresholds sit just outside day-to-day noise for recreational runners.
 */
function effortOf(
  paceVsRecent: number | null,
  distanceVsRecent: number | null,
): CoachFacts['effort'] {
  if (
    (paceVsRecent !== null && paceVsRecent <= -4) ||
    (distanceVsRecent !== null && distanceVsRecent >= 30)
  ) {
    return 'hard';
  }
  if (paceVsRecent !== null && paceVsRecent >= 4) return 'easy';
  return 'moderate';
}

function splitTrend(splits: readonly Split[]): CoachFacts['splitTrend'] {
  if (splits.length < 2) return null;
  const half = Math.floor(splits.length / 2);
  const first = mean(splits.slice(0, half).map((s) => s.paceSecPerKm));
  const second = mean(splits.slice(splits.length - half).map((s) => s.paceSecPerKm));
  const change = percent(second, first);
  if (change <= -2) return 'negative';
  if (change >= 2) return 'positive';
  return 'even';
}

function fastest(splits: readonly Split[]): CoachFacts['fastestSplit'] {
  if (splits.length === 0) return null;
  const best = splits.reduce((a, b) => (b.paceSecPerKm < a.paceSecPerKm ? b : a));
  return { index: best.index, paceSecPerKm: best.paceSecPerKm };
}

function variability(splits: readonly Split[]): number | null {
  if (splits.length < 2) return null;
  const paces = splits.map((s) => s.paceSecPerKm);
  const m = mean(paces);
  const sd = Math.sqrt(mean(paces.map((p) => (p - m) ** 2)));
  return (sd / m) * 100;
}

function toRunLike(run: CoachRun) {
  return {
    startedAt: run.startedAt,
    distanceM: run.summary.distanceM,
    movingMs: run.summary.movingMs,
  };
}

function percent(value: number, baseline: number): number {
  return ((value - baseline) / baseline) * 100;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function isNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}
