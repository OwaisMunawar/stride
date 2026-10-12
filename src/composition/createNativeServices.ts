import { createOpenAI } from '@ai-sdk/openai';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { StrideCoach } from '@modules/stride-coach/src';

import { COACH_ENDPOINT, COACH_MODEL, IS_DEMO } from '@/core/config/env';
import { createOnDeviceCoach } from '@/features/coach/engine/onDeviceCoach';
import { createServerCoach } from '@/features/coach/engine/serverCoach';
import { loadSimulatedRun } from '@/features/demo/data/bundledRoute';
import { seedDemoRuns } from '@/features/demo/data/seedDemoRuns';
import { createGpxFiles } from '@/features/export/data/gpxFiles';
import { createExpoLiveActivity } from '@/features/recording/live-activity/expoLiveActivity';
import { noopLiveActivity } from '@/features/recording/live-activity/LiveActivityController';
import { createDeviceLocationSource } from '@/features/recording/location/deviceLocationSource';
import { createLocationPermissions } from '@/features/recording/location/permissions';
import { createReplayLocationSource } from '@/features/recording/location/replayLocationSource';
import { createSettingsRepository } from '@/features/settings/data/settingsRepository';

import { buildServices, type AppServices } from './AppServices';
import { fixesStored } from './backgroundLocation';
import { openAppDatabase } from './database';

export async function createNativeServices(): Promise<AppServices> {
  const db = await openAppDatabase();
  const settings = await createSettingsRepository(db);

  const serverModel = COACH_ENDPOINT
    ? createOpenAI({
        baseURL: COACH_ENDPOINT,
        // The endpoint holds the real credentials; the SDK insists on a value.
        apiKey: 'stride-client',
      }).chat(COACH_MODEL)
    : null;

  const services = buildServices({
    db,
    settings,
    fixesStored,
    isDemo: IS_DEMO,
    createDeviceSource: () => createDeviceLocationSource(() => settings.store.get().activity),
    createReplaySource: (track, onFinished) =>
      createReplayLocationSource({ track, rate: 10, onFinished }),
    loadSimulatedRun,
    liveActivity: Platform.OS === 'ios' ? createExpoLiveActivity() : noopLiveActivity,
    permissions: createLocationPermissions(),
    gpx: createGpxFiles(),
    coaches: {
      onDevice: createOnDeviceCoach(StrideCoach),
      server: createServerCoach({ model: serverModel }),
    },
    onSplit: () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  if (IS_DEMO) {
    await seedDemoRuns({
      runs: services.runs,
      weightKg: settings.store.get().weightKg,
      now: Date.now(),
    });
  }
  await services.engine.restore();
  return services;
}
