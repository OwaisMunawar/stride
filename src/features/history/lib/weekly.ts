/**
 * Calendar maths for the history header. Weeks start on Monday (ISO 8601), the
 * convention in training plans, and everything is in the device's local time:
 * a 23:30 run belongs to the day the runner experienced it.
 */
export type RunLike = { startedAt: number; distanceM: number; movingMs: number };

const DAY_MS = 86_400_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d.getTime();
}

function addDays(t: number, days: number): number {
  // setDate rather than adding 86.4M ms, so DST changes do not shift days.
  const d = new Date(t);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export type WeekTotals = {
  distanceM: number;
  movingMs: number;
  runs: number;
  /** Seven entries, Monday first: distance per day. */
  days: number[];
};

export function weekTotals(runs: readonly RunLike[], now: number): WeekTotals {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const days = [0, 0, 0, 0, 0, 0, 0];
  let distanceM = 0;
  let movingMs = 0;
  let count = 0;
  for (const run of runs) {
    if (run.startedAt < weekStart || run.startedAt >= weekEnd) continue;
    const day = Math.round((startOfDay(run.startedAt) - weekStart) / DAY_MS);
    days[Math.min(6, Math.max(0, day))]! += run.distanceM;
    distanceM += run.distanceM;
    movingMs += run.movingMs;
    count++;
  }
  return { distanceM, movingMs, runs: count, days };
}

/** Distance of the week before, for the "vs last week" comparison. */
export function previousWeekDistance(runs: readonly RunLike[], now: number): number {
  const thisWeek = startOfWeek(now);
  const lastWeek = addDays(thisWeek, -7);
  return runs
    .filter((r) => r.startedAt >= lastWeek && r.startedAt < thisWeek)
    .reduce((sum, r) => sum + r.distanceM, 0);
}

/**
 * Consecutive days with at least one activity, ending today or yesterday. A
 * streak survives until the end of the day after the last run: not having run
 * yet this morning should not show zero.
 */
export function currentStreak(runs: readonly RunLike[], now: number): number {
  const days = new Set(runs.map((r) => startOfDay(r.startedAt)));
  const today = startOfDay(now);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
