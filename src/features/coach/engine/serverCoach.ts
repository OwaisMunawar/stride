import { generateText, Output, type LanguageModel } from 'ai';

import { AppError, toAppError } from '@/core/errors/AppError';

import { insightSchema, type Coach } from '../Coach';
import { computeFacts } from '../lib/facts';
import { guardInsight } from '../lib/guard';
import { planNextRun } from '../lib/plan';
import { COACH_INSTRUCTIONS, coachPrompt } from '../lib/prompt';

/**
 * A language model behind any OpenAI-compatible endpoint, via the AI SDK's
 * structured output: the zod schema is sent as a JSON schema and the reply is
 * parsed against it. Only computed facts leave the device, never the route.
 *
 * The model is injected, so tests use the SDK's mock model and the app builds
 * one from the configured endpoint.
 */
export function createServerCoach(options: {
  model: LanguageModel | null;
  timeoutMs?: number;
}): Coach {
  return {
    id: 'server',
    isAvailable: async () => options.model !== null,
    async analyze(context) {
      if (!options.model)
        throw new AppError('COACH_UNAVAILABLE', 'No coach endpoint is configured');
      const facts = computeFacts(context);
      const baseline = planNextRun(facts);
      // AbortSignal.timeout is not available on every JS engine React Native ships.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
      try {
        const { output } = await generateText({
          model: options.model,
          instructions: COACH_INSTRUCTIONS,
          prompt: coachPrompt(facts, baseline, context.units),
          output: Output.object({ schema: insightSchema, name: 'RunInsight' }),
          temperature: 0.4,
          maxRetries: 1,
          abortSignal: controller.signal,
        });
        return {
          ...guardInsight(output, facts, baseline),
          provider: 'server',
          generatedAt: context.now,
        };
      } catch (error) {
        throw toAppError(error, 'COACH_FAILED');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
