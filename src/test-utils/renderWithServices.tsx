import { render } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { buildServices, type AppServices } from '@/composition/AppServices';
import { ServicesProvider } from '@/composition/ServicesProvider';
import { ThemeProvider } from '@/core/theme';
import { ToastProvider } from '@/core/ui';
import { createOnDeviceCoach } from '@/features/coach/engine/onDeviceCoach';
import { createServerCoach } from '@/features/coach/engine/serverCoach';
import { seedDemoRuns } from '@/features/demo/data/seedDemoRuns';
import { type GpxFiles } from '@/features/export/data/gpxFiles';
import { createSettingsRepository } from '@/features/settings/data/settingsRepository';

import {
  createFakeLiveActivity,
  createFakePermissions,
  createManualSource,
  type ManualSource,
} from './fakes';
import { createMigratedTestDriver } from './sqliteTestDriver';
import { straightFixes } from './tracks';

export const TEST_NOW = new Date(2026, 9, 14, 12, 0).getTime();

/**
 * The real container on an in-memory database: real repositories, engine and
 * coach, with fake platform edges (location, Live Activity, files).
 */
export async function createTestServices(options: { seed?: boolean; demo?: boolean } = {}) {
  const db = await createMigratedTestDriver();
  const settings = await createSettingsRepository(db);
  const sources: ManualSource[] = [];
  const live = createFakeLiveActivity();
  const permissions = createFakePermissions('background');
  const gpx: GpxFiles = { share: jest.fn(async () => undefined), pick: jest.fn(async () => null) };

  const services = buildServices({
    db,
    settings,
    isDemo: options.demo ?? true,
    createDeviceSource: () => {
      const source = createManualSource('device', TEST_NOW);
      sources.push(source);
      return source;
    },
    createReplaySource: () => {
      const source = createManualSource('replay', TEST_NOW);
      sources.push(source);
      return source;
    },
    loadSimulatedRun: async () => straightFixes({ speedMps: 3, seconds: 60, startT: TEST_NOW }),
    liveActivity: live.controller,
    permissions,
    gpx,
    coaches: { onDevice: createOnDeviceCoach(null), server: createServerCoach({ model: null }) },
    now: () => TEST_NOW,
  });
  if (options.seed ?? true) {
    await seedDemoRuns({ runs: services.runs, weightKg: 70, now: TEST_NOW });
  }
  return { services, sources, live, permissions, gpx };
}

export async function renderWithServices(ui: ReactElement, services: AppServices) {
  return await render(
    <SafeAreaProvider>
      <ThemeProvider scheme="light">
        <ServicesProvider services={services}>
          <ToastProvider>{ui}</ToastProvider>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}
