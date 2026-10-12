/**
 * Build-time switches. Expo inlines `EXPO_PUBLIC_*` at bundle time, so none of
 * these can be flipped at runtime and none of them may hold a secret.
 */

/** Seeds fictional runs and offers "Simulate run" (a bundled GPX replayed at 10x). */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

/**
 * Optional OpenAI-compatible endpoint for the server coach: your own proxy, or a
 * local model server on the LAN. The app never ships a provider API key; the
 * endpoint is expected to hold credentials itself.
 */
export const COACH_ENDPOINT = process.env.EXPO_PUBLIC_COACH_ENDPOINT ?? '';
export const COACH_MODEL = process.env.EXPO_PUBLIC_COACH_MODEL ?? 'gpt-4.1-mini';
