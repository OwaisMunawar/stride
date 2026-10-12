/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  // Worklets ships native-only entry points; this resolver picks the JS ones.
  resolver: 'react-native-worklets/jest/resolver',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Screen tests seed a real SQLite database; the first one in a worker also
  // pays for transforming the app, which can exceed the 5 s default on CI.
  testTimeout: 20_000,
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@shopify/react-native-skia|@legendapp/.*|@maplibre/.*|ai|@ai-sdk/.*|@standard-schema/.*|@workflow/.*|eventsource-parser))',
  ],
  // The gate covers domain logic, repositories, the recording engine and the
  // coaches. Screens are covered by component tests and Maestro flows instead
  // of line counts.
  collectCoverageFrom: [
    'src/**/lib/**/*.ts',
    'src/core/db/**/*.ts',
    'src/core/errors/**/*.ts',
    'src/core/units/**/*.ts',
    'src/features/**/data/**/*.ts',
    'src/features/**/engine/**/*.ts',
    'src/features/recording/location/**/*.ts',
    'src/features/export/useCases.ts',
    // Thin adapters over native modules, exercised on the simulator instead.
    '!src/core/db/expoSqliteDriver.ts',
    '!src/features/recording/location/deviceLocationSource.ts',
    '!src/features/recording/location/backgroundTask.ts',
    '!src/features/recording/location/permissions.ts',
    '!src/features/export/data/**',
    '!src/features/demo/data/bundledRoute.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: { lines: 90, statements: 90, functions: 90, branches: 80 },
  },
  coverageReporters: ['text-summary', 'lcov'],
};
