import { type UnitSystem } from '@/core/units/units';

import { type CoachFacts } from './facts';
import { type NextRunPlan } from './plan';

/**
 * Shared by the on-device and server coaches. The model is given computed
 * facts and a baseline plan, never raw GPS, and told to write about them. That
 * keeps the prompt within the on-device model's small context and leaves the
 * maths to code that has tests.
 */
export const COACH_INSTRUCTIONS = `You are a supportive, concise endurance coach.
You write a short post-session summary and suggest the next session.
Use only the facts given. Never invent numbers, places, heart rate or weather.
Write in second person, plain language, no emoji, no exclamation marks.
The summary is at most two sentences. Each highlight is one short sentence.
Paces are seconds per kilometre in the data; when you mention a pace in text,
format it as minutes:seconds in the user's preferred unit.
The next session must stay close to the baseline plan; you may adjust the kind,
distance and pace slightly if the facts justify it, and explain why in one sentence.`;

export function coachPrompt(facts: CoachFacts, baseline: NextRunPlan, units: UnitSystem): string {
  const rounded = Object.fromEntries(
    Object.entries(facts).map(([key, value]) => [
      key,
      typeof value === 'number' ? Math.round(value * 10) / 10 : value,
    ]),
  );
  return [
    `Preferred units: ${units === 'metric' ? 'kilometres' : 'miles'}.`,
    `Session facts (JSON): ${JSON.stringify(rounded)}`,
    `Baseline plan (JSON): ${JSON.stringify(baseline)}`,
  ].join('\n');
}
