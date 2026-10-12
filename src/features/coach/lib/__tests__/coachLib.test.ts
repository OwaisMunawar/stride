import { isAppError } from '@/core/errors/AppError';

import { BASE_HISTORY, coachRun, context } from '../../__tests__/coachFixtures';
import { computeFacts, median } from '../facts';
import { guardInsight } from '../guard';
import { planNextRun } from '../plan';
import { COACH_INSTRUCTIONS, coachPrompt } from '../prompt';
import { createRuleCoach, ruleInsight } from '../ruleCoach';

describe('computeFacts', () => {
  it('compares a run with recent same-activity history', () => {
    const run = coachRun('r', 0, 6, 340);
    const facts = computeFacts(context(run, [350, 345, 340, 335, 330, 330], BASE_HISTORY));
    expect(facts.recentRuns).toBe(5);
    expect(facts.recentPaceSecPerKm).toBe(362);
    expect(facts.paceVsRecentPct).toBeCloseTo(-6.1, 1);
    expect(facts.effort).toBe('hard');
    expect(facts.splitTrend).toBe('negative');
    expect(facts.fastestSplit).toEqual({ index: 5, paceSecPerKm: 330 });
    expect(facts.fastestRecent).toBe(true);
    expect(facts.streakDays).toBe(1);
  });

  it('ignores rides when coaching a run, and handles no history', () => {
    const run = coachRun('r', 0, 5, 360);
    const facts = computeFacts(context(run, [360], [coachRun('ride', 1, 30, 120, 'ride')]));
    expect(facts.recentRuns).toBe(0);
    expect(facts.paceVsRecentPct).toBeNull();
    expect(facts.splitTrend).toBeNull();
    expect(facts.paceVariabilityPct).toBeNull();
    expect(facts.weekChangePct).toBeNull();
    expect(facts.effort).toBe('moderate');
  });

  it('detects fading and easy days', () => {
    const run = coachRun('r', 0, 6, 390);
    const facts = computeFacts(context(run, [370, 375, 385, 400, 410, 405], BASE_HISTORY));
    expect(facts.splitTrend).toBe('positive');
    expect(facts.effort).toBe('easy');
  });

  it('takes a proper median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('planNextRun', () => {
  it('prescribes recovery after a hard effort', () => {
    const run = coachRun('r', 0, 6, 330);
    const plan = planNextRun(
      computeFacts(context(run, [330, 330, 330, 330, 330, 330], BASE_HISTORY)),
    );
    expect(plan.kind).toBe('recovery');
    expect(plan.targetPaceSecPerKm).toBeGreaterThan(362);
    expect(plan.distanceKm).toBeLessThan(6);
  });

  it('prescribes recovery after the longest run in six weeks', () => {
    const run = coachRun('r', 0, 7, 365);
    const plan = planNextRun(
      computeFacts(context(run, [365, 365, 365, 365, 365, 365, 365], BASE_HISTORY)),
    );
    expect(plan.kind).toBe('recovery');
    expect(plan.rationale).toMatch(/longest/);
  });

  it('holds volume when the week jumps by more than ten percent', () => {
    const history = [
      coachRun('a', 1, 5.5, 362),
      coachRun('b', 2, 5.5, 362),
      coachRun('c', 8, 5.5, 362),
      coachRun('d', 20, 6, 362),
    ];
    const run = coachRun('r', 0, 5.5, 362);
    const facts = computeFacts(context(run, [362, 362, 362, 362, 362], history));
    expect(facts.weekChangePct).toBeGreaterThan(10);
    expect(planNextRun(facts).kind).toBe('easy');
  });

  it('earns a tempo after a controlled run and a long run in a light week', () => {
    const steady = coachRun('r', 0, 5.8, 360);
    const tempo = planNextRun(
      computeFacts(context(steady, [361, 360, 359, 360, 360], BASE_HISTORY)),
    );
    expect(tempo.kind).toBe('tempo');
    expect(tempo.targetPaceSecPerKm).toBeLessThan(362);

    const shortRun = coachRun('r', 0, 4, 362);
    const lightWeek = [coachRun('old', 20, 6, 362), coachRun('old2', 25, 6, 362)];
    const long = planNextRun(computeFacts(context(shortRun, [350, 355, 370, 380], lightWeek)));
    expect(long.kind).toBe('long');
  });

  it('defaults to easy and sizes rides in five-kilometre steps', () => {
    const ride = coachRun('r', 0, 22, 150, 'ride');
    const plan = planNextRun(computeFacts(context(ride, [150], [])));
    expect(plan.kind).toBe('easy');
    expect(plan.distanceKm % 5).toBe(0);
  });
});

describe('rule coach', () => {
  it('writes a deterministic summary, highlights and next run', async () => {
    const run = coachRun('r', 0, 6, 340, 'run', 60);
    const ctx = context(run, [350, 345, 340, 335, 330, 330], BASE_HISTORY);
    const insight = await createRuleCoach().analyze(ctx);
    expect(insight.provider).toBe('rules');
    expect(insight.summary).toContain('6.00 km run in 34:00 at 5:40 /km.');
    expect(insight.summary).toContain('finished faster than you started');
    expect(insight.summary).toContain('6% quicker');
    expect(insight.highlights.length).toBeGreaterThan(1);
    expect(insight.highlights.length).toBeLessThanOrEqual(4);
    expect(insight.highlights.join(' ')).toMatch(/Fastest average pace/);
    expect(await createRuleCoach().isAvailable()).toBe(true);
    expect(ruleInsight(ctx)).toEqual(insight);
  });

  it('speaks miles and feet for imperial users', () => {
    const run = coachRun('r', 0, 6, 370, 'run', 80);
    const insight = ruleInsight(context(run, [380, 375, 370, 365], BASE_HISTORY, 'imperial'));
    expect(insight.summary).toContain('mi run');
    expect(insight.highlights.join(' ')).toMatch(/ft of climbing/);
  });

  it('handles a first-ever run', () => {
    const insight = ruleInsight(context(coachRun('r', 0, 3, 400), [400, 405, 395], []));
    expect(insight.summary).toContain('Log a few more');
  });

  it('notes an even pace and a slowdown', () => {
    const even = ruleInsight(
      context(coachRun('r', 0, 6, 361), [361, 360, 361, 362, 361, 360], BASE_HISTORY),
    );
    expect(even.summary).toContain('remarkably even');
    expect(even.summary).toContain('in line with your recent pace');
    const fade = ruleInsight(
      context(coachRun('r', 0, 6, 390), [370, 375, 385, 400, 410, 405], BASE_HISTORY),
    );
    expect(fade.summary).toContain('slowed in the second half');
    expect(fade.summary).toContain('easier than your recent average');
  });
});

describe('guardInsight', () => {
  const facts = computeFacts(
    context(coachRun('r', 0, 6, 360), [360, 360, 360, 360, 360, 360], BASE_HISTORY),
  );
  const baseline = planNextRun(facts);

  it('clamps confident nonsense back near the baseline', () => {
    const guarded = guardInsight(
      {
        summary: 'Great run.',
        highlights: ['a', 'b'],
        nextRun: { kind: 'long', distanceKm: 42, targetPaceSecPerKm: 180, rationale: 'Go big.' },
      },
      facts,
      baseline,
    );
    expect(guarded.nextRun.distanceKm).toBeLessThanOrEqual(
      Math.max(baseline.distanceKm * 1.5, 7.2),
    );
    expect(guarded.nextRun.targetPaceSecPerKm).toBeGreaterThanOrEqual(
      Math.round(baseline.targetPaceSecPerKm * 0.85),
    );
  });

  it('rejects output that does not match the schema', () => {
    const error = (() => {
      try {
        guardInsight({ summary: '', highlights: [] }, facts, baseline);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(isAppError(error, 'COACH_INVALID_OUTPUT')).toBe(true);
  });
});

describe('prompt', () => {
  it('sends rounded facts and the baseline, never coordinates', () => {
    const facts = computeFacts(context(coachRun('r', 0, 6, 361.234), [361], BASE_HISTORY));
    const prompt = coachPrompt(facts, planNextRun(facts), 'imperial');
    expect(prompt).toContain('Preferred units: miles.');
    expect(prompt).toContain('"paceSecPerKm":361.2');
    expect(prompt).not.toMatch(/"(lat|lon|latitude|longitude)"/);
    expect(COACH_INSTRUCTIONS).toMatch(/Never invent numbers/);
  });
});
