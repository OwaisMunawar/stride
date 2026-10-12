// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

// The only module allowed to reach the network on its own initiative. Map
// tiles are fetched by the native map view; everything else stays on device,
// and this is what the privacy section of the README promises.
const SERVER_COACH = 'src/features/coach/engine/serverCoach.ts';

const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: `Stride makes no network calls outside ${SERVER_COACH}. See docs/ARCHITECTURE.md (ADR-007).`,
}));

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'modules/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'ai', message: `The AI SDK is only used by ${SERVER_COACH}.` },
            { name: '@ai-sdk/openai', message: `The AI SDK is only used by ${SERVER_COACH}.` },
          ],
        },
      ],
    },
  },
  {
    files: [SERVER_COACH, 'src/composition/**/*.ts', 'src/**/__tests__/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Domain code stays framework-free so it runs in plain Node and in the
    // background task without pulling in UI modules.
    files: ['src/**/lib/**/*.ts'],
    ignores: ['src/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'react-native-*',
                'expo',
                'expo-*',
                '@shopify/*',
                '@maplibre/*',
                'ai',
              ],
            },
          ],
        },
      ],
    },
  },
]);
