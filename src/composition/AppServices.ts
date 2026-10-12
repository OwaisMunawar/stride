import { type SqlDriver } from '@/core/db/SqlDriver';
import { createEmitter, type Emitter } from '@/core/lib/store';
import { createCoachService } from '@/features/coach/engine/coachService';
import { type Coach, type CoachProviderId } from '@/features/coach/Coach';
import { createInsightRepository } from '@/features/coach/data/insightRepository';
import { createRuleCoach } from '@/features/coach/lib/ruleCoach';
import { type GpxFiles } from '@/features/export/data/gpxFiles';
import { createRunRepository } from '@/features/history/data/runRepository';
import { createSessionRepository } from '@/features/recording/data/sessionRepository';
import {
  createRecordingEngine,
  type SourceKind,
} from '@/features/recording/engine/RecordingEngine';
import { type LiveActivityController } from '@/features/recording/live-activity/LiveActivityController';
import { type LocationPermissions } from '@/features/recording/location/permissions';
import { type LocationSource } from '@/features/recording/location/LocationSource';
import { type SettingsRepository } from '@/features/settings/data/settingsRepository';
import { type Fix } from '@/features/tracking/lib/types';

/**
 * Everything platform-specific the app needs, injected. The app passes the
 * native implementations; component tests pass in-memory fakes. Nothing in
 * features/ reaches for a module-level instance.
 */
export type PlatformParts = {
  db: SqlDriver;
  settings: SettingsRepository;
  createDeviceSource: () => LocationSource;
  createReplaySource: (track: readonly Fix[], onFinished: () => void) => LocationSource;
  loadSimulatedRun: () => Promise<Fix[]>;
  liveActivity: LiveActivityController;
  permissions: LocationPermissions;
  gpx: GpxFiles;
  coaches: { onDevice: Coach; server: Coach };
  onSplit?: (index: number) => void;
  /** Shared with the background task, which fires it after storing fixes. */
  fixesStored?: Emitter<string>;
  isDemo: boolean;
  now?: () => number;
};

export function buildServices(parts: PlatformParts) {
  const runsChanged = createEmitter<void>();
  const fixesStored = parts.fixesStored ?? createEmitter<string>();
  const runs = createRunRepository(parts.db, runsChanged);
  const sessions = createSessionRepository(parts.db, runsChanged);
  const insights = createInsightRepository(parts.db);
  const settings = () => parts.settings.store.get();

  // The replay track is loaded before the engine asks for a source, because
  // creating a source is synchronous.
  let replayTrack: readonly Fix[] = [];

  const engine = createRecordingEngine({
    sessions,
    fixesStored,
    liveActivity: parts.liveActivity,
    settings,
    onSplit: (index) => {
      if (settings().haptics) parts.onSplit?.(index);
    },
    createSource: (kind: SourceKind) =>
      kind === 'device'
        ? parts.createDeviceSource()
        : parts.createReplaySource(replayTrack, () => {
            void engine.finish().catch(() => undefined);
          }),
  });

  const coaches: Record<CoachProviderId, Coach> = {
    rules: createRuleCoach(),
    onDevice: parts.coaches.onDevice,
    server: parts.coaches.server,
  };

  const coach = createCoachService({
    coaches,
    runs,
    insights,
    preferred: () => settings().coach,
    units: () => settings().units,
    now: parts.now,
  });

  return {
    isDemo: parts.isDemo,
    db: parts.db,
    runs,
    sessions,
    fixesStored,
    settings: parts.settings,
    engine,
    coach,
    permissions: parts.permissions,
    gpx: parts.gpx,
    now: parts.now ?? Date.now,
    async startSimulatedRun() {
      replayTrack = await parts.loadSimulatedRun();
      return engine.start('run', 'replay');
    },
    dispose() {
      engine.dispose();
    },
  };
}

export type AppServices = ReturnType<typeof buildServices>;
