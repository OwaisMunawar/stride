import { createEmitter } from '@/core/lib/store';
import { createSessionRepository } from '@/features/recording/data/sessionRepository';
import { createActiveRunSink } from '@/features/recording/engine/RecordingEngine';
import { defineLocationTask } from '@/features/recording/location/backgroundTask';
import { type FixSink } from '@/features/recording/location/LocationSource';

import { openAppDatabase } from './database';

/**
 * Fired after the background task stores fixes. Lives here, not in a feature,
 * because it has to exist before (and independently of) the service container:
 * on a headless relaunch the task runs with no UI at all.
 */
export const fixesStored = createEmitter<string>();

let sink: Promise<FixSink> | null = null;

defineLocationTask(() => {
  sink ??= openAppDatabase().then((db) =>
    createActiveRunSink(createSessionRepository(db, createEmitter<void>()), fixesStored),
  );
  return sink;
});
