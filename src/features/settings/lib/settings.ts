import { z } from 'zod';

/**
 * User preferences. Parsed with defaults per field, so a value written by an
 * older or newer build never takes the whole settings screen down: an unknown
 * value for one key falls back to that key's default and nothing else.
 */
export const settingsSchema = z.object({
  units: z.enum(['metric', 'imperial']).catch('metric'),
  autoPause: z.enum(['off', 'low', 'normal', 'high']).catch('normal'),
  coach: z.enum(['rules', 'onDevice', 'server']).catch('rules'),
  activity: z.enum(['run', 'ride']).catch('run'),
  weightKg: z.number().min(30).max(250).catch(70),
  haptics: z.boolean().catch(true),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const defaultSettings: Settings = settingsSchema.parse({});

export function parseSettings(entries: Record<string, unknown>): Settings {
  return settingsSchema.parse(entries);
}
