import { AppError, toAppError } from '@/core/errors/AppError';

import { type Coach } from '../Coach';
import { computeFacts } from '../lib/facts';
import { guardInsight } from '../lib/guard';
import { planNextRun } from '../lib/plan';
import { COACH_INSTRUCTIONS, coachPrompt } from '../lib/prompt';

/** The slice of the native module this coach needs; injected so tests can stub it. */
export type OnDeviceModel = {
  availability(): { status: string; reason: string | null };
  generateInsight(instructions: string, prompt: string): Promise<unknown>;
};

/**
 * Apple Foundation Models (iOS 26, Apple Intelligence devices), through the
 * local `stride-coach` Expo module. Guided generation returns the insight as
 * typed Swift values, so there is no JSON to repair; the result is still
 * validated and clamped like any other model output. Nothing leaves the phone.
 */
export function createOnDeviceCoach(model: OnDeviceModel | null): Coach {
  const available = () => model?.availability().status === 'available';
  return {
    id: 'onDevice',
    isAvailable: async () => available(),
    async analyze(context) {
      if (!model || !available()) {
        const reason = model?.availability().reason ?? 'notLinked';
        throw new AppError('COACH_UNAVAILABLE', `On-device model unavailable: ${reason}`);
      }
      const facts = computeFacts(context);
      const baseline = planNextRun(facts);
      try {
        const raw = await model.generateInsight(
          COACH_INSTRUCTIONS,
          coachPrompt(facts, baseline, context.units),
        );
        return {
          ...guardInsight(raw, facts, baseline),
          provider: 'onDevice',
          generatedAt: context.now,
        };
      } catch (error) {
        throw toAppError(error, 'COACH_FAILED');
      }
    },
  };
}

export function onDeviceUnavailableReason(model: OnDeviceModel | null): string | null {
  if (!model) return 'Requires iOS 26 and Apple Intelligence.';
  const { status, reason } = model.availability();
  if (status === 'available') return null;
  switch (reason) {
    case 'appleIntelligenceNotEnabled':
      return 'Turn on Apple Intelligence in Settings to use it.';
    case 'modelNotReady':
      return 'The model is still downloading. Try again later.';
    case 'deviceNotEligible':
      return 'This device does not support Apple Intelligence.';
    default:
      return 'Requires iOS 26 and Apple Intelligence.';
  }
}
