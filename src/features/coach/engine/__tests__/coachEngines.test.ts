import { MockLanguageModelV4 } from 'ai/test';

import { isAppError } from '@/core/errors/AppError';
import { createEmitter } from '@/core/lib/store';
import { createRunRepository } from '@/features/history/data/runRepository';
import { summarizeRun } from '@/features/tracking/lib/summarize';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';
import { straightFixes, toPoints } from '@/test-utils/tracks';

import { BASE_HISTORY, coachRun, context } from '../../__tests__/coachFixtures';
import { type Coach, type CoachProviderId } from '../../Coach';
import { createInsightRepository } from '../../data/insightRepository';
import { createRuleCoach } from '../../lib/ruleCoach';
import { createCoachService } from '../coachService';
import {
  createOnDeviceCoach,
  onDeviceUnavailableReason,
  type OnDeviceModel,
} from '../onDeviceCoach';
import { createServerCoach } from '../serverCoach';

const reply = {
  summary: 'Solid, even six kilometres.',
  highlights: ['Even splits.', 'Steady effort.'],
  nextRun: {
    kind: 'tempo',
    distanceKm: 5.5,
    targetPaceSecPerKm: 345,
    rationale: 'You held pace well.',
  },
};

function mockModel(text: string) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 10, text: 10, reasoning: undefined },
      },
      warnings: [],
    },
  });
}

const ctx = context(coachRun('r', 0, 6, 358), [360, 359, 358, 357, 356, 358], BASE_HISTORY);

describe('server coach', () => {
  it('asks for structured output and validates it', async () => {
    const model = mockModel(JSON.stringify(reply));
    const coach = createServerCoach({ model });
    expect(await coach.isAvailable()).toBe(true);
    const insight = await coach.analyze(ctx);
    expect(insight).toMatchObject({
      provider: 'server',
      summary: reply.summary,
      nextRun: { kind: 'tempo' },
    });
    const call = model.doGenerateCalls[0]!;
    expect(call.responseFormat).toMatchObject({ type: 'json' });
    expect(JSON.stringify(call.prompt)).toContain('Session facts');
  });

  it('turns malformed replies into a typed error', async () => {
    const coach = createServerCoach({ model: mockModel('not json at all') });
    const error = await coach.analyze(ctx).catch((e: unknown) => e);
    expect(isAppError(error, 'COACH_FAILED')).toBe(true);
  });

  it('is unavailable without an endpoint', async () => {
    const coach = createServerCoach({ model: null });
    expect(await coach.isAvailable()).toBe(false);
    expect(isAppError(await coach.analyze(ctx).catch((e: unknown) => e), 'COACH_UNAVAILABLE')).toBe(
      true,
    );
  });
});

describe('on-device coach', () => {
  const model = (
    status: string,
    reason: string | null,
    output: unknown = reply,
  ): OnDeviceModel => ({
    availability: () => ({ status, reason }),
    generateInsight: jest.fn(async () => output),
  });

  it('uses Foundation Models output when available', async () => {
    const native = model('available', null);
    const coach = createOnDeviceCoach(native);
    expect(await coach.isAvailable()).toBe(true);
    const insight = await coach.analyze(ctx);
    expect(insight.provider).toBe('onDevice');
    expect(native.generateInsight).toHaveBeenCalledWith(
      expect.stringContaining('coach'),
      expect.stringContaining('Baseline plan'),
    );
  });

  it('reports why it is unavailable', async () => {
    expect(onDeviceUnavailableReason(null)).toMatch(/iOS 26/);
    expect(onDeviceUnavailableReason(model('available', null))).toBeNull();
    expect(onDeviceUnavailableReason(model('unavailable', 'appleIntelligenceNotEnabled'))).toMatch(
      /Turn on/,
    );
    expect(onDeviceUnavailableReason(model('unavailable', 'modelNotReady'))).toMatch(/downloading/);
    expect(onDeviceUnavailableReason(model('unavailable', 'deviceNotEligible'))).toMatch(
      /does not support/,
    );
    expect(onDeviceUnavailableReason(model('unsupported', 'requiresIOS26'))).toMatch(/iOS 26/);
    const coach = createOnDeviceCoach(model('unavailable', 'modelNotReady'));
    expect(await coach.isAvailable()).toBe(false);
    expect(isAppError(await coach.analyze(ctx).catch((e: unknown) => e), 'COACH_UNAVAILABLE')).toBe(
      true,
    );
    expect(
      isAppError(
        await createOnDeviceCoach(null)
          .analyze(ctx)
          .catch((e: unknown) => e),
        'COACH_UNAVAILABLE',
      ),
    ).toBe(true);
  });

  it('rejects output that fails validation', async () => {
    const coach = createOnDeviceCoach(model('available', null, { summary: 'x' }));
    expect(
      isAppError(await coach.analyze(ctx).catch((e: unknown) => e), 'COACH_INVALID_OUTPUT'),
    ).toBe(true);
  });
});

describe('coach service', () => {
  async function setup(preferred: CoachProviderId, failing = false) {
    const db = await createMigratedTestDriver();
    const runs = createRunRepository(db, createEmitter<void>());
    const insights = createInsightRepository(db);
    const points = toPoints(
      straightFixes({ speedMps: 2.8, seconds: 1800, startT: Date.now() - 3_600_000 }),
    );
    await runs.insertFinished({
      meta: {
        id: 'r',
        title: 'Run',
        activity: 'run',
        source: 'import',
        autoPause: 'off',
        startedAt: points[0]!.t,
      },
      endedAt: points.at(-1)!.t,
      summary: summarizeRun({
        points,
        activity: 'run',
        weightKg: 70,
        startedAt: points[0]!.t,
        endedAt: points.at(-1)!.t,
      }),
      points,
    });
    const server: Coach = failing
      ? {
          id: 'server',
          isAvailable: async () => true,
          analyze: async () => Promise.reject(new Error('offline')),
        }
      : createServerCoach({ model: mockModel(JSON.stringify(reply)) });
    const service = createCoachService({
      coaches: { rules: createRuleCoach(), onDevice: createOnDeviceCoach(null), server },
      runs,
      insights,
      preferred: () => preferred,
      units: () => 'metric',
    });
    return { service, insights, db };
  }

  it('generates once and serves the cached insight afterwards', async () => {
    const { service, insights } = await setup('rules');
    const first = await service.insightFor('r');
    expect(first.provider).toBe('rules');
    const save = jest.spyOn(insights, 'save');
    expect(await service.insightFor('r')).toEqual(first);
    expect(save).not.toHaveBeenCalled();
  });

  it('uses the preferred model and falls back to rules on failure', async () => {
    expect((await (await setup('server')).service.insightFor('r')).provider).toBe('server');
    const fallback = await (await setup('server', true)).service.insightFor('r');
    expect(fallback).toMatchObject({ provider: 'rules', fallbackReason: 'COACH_FAILED' });
    const unavailable = await (await setup('onDevice')).service.regenerate('r');
    expect(unavailable).toMatchObject({ provider: 'rules', fallbackReason: 'COACH_UNAVAILABLE' });
  });

  it('reports availability per provider', async () => {
    const { service } = await setup('rules');
    expect(await service.availability()).toEqual({ rules: true, onDevice: false, server: true });
  });

  it('regenerates an insight stored by an older schema', async () => {
    const { service, db } = await setup('rules');
    await service.insightFor('r');
    await db.run('UPDATE insights SET payload = \'{"summary":1}\'');
    expect((await service.insightFor('r')).provider).toBe('rules');
    await db.run("UPDATE insights SET payload = 'garbage'");
    expect((await service.insightFor('r')).provider).toBe('rules');
  });
});
