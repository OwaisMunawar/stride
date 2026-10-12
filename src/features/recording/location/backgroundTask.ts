import { type LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { fixFromLocation } from './fixFromLocation';
import { type FixSink } from './LocationSource';

export const LOCATION_TASK = 'stride.location-updates';

/**
 * Registers the background location task. Must run at module scope on every
 * launch, including the headless ones the OS starts to deliver fixes, which
 * is why it takes a sink *resolver*: on a cold background start nothing has
 * opened the database yet.
 *
 * Deliberately tiny. It converts and stores; filtering, the state machine and
 * the Live Activity all happen in the engine, which reads what was stored.
 * The less this does, the less can go wrong while the screen is off.
 */
export function defineLocationTask(resolveSink: () => Promise<FixSink>): void {
  if (TaskManager.isTaskDefined(LOCATION_TASK)) return;
  TaskManager.defineTask<{ locations: LocationObject[] }>(
    LOCATION_TASK,
    async ({ data, error }) => {
      if (error) {
        console.warn(`[location] ${error.message}`);
        return;
      }
      if (!data?.locations?.length) return;
      const sink = await resolveSink();
      await sink(data.locations.map(fixFromLocation));
    },
  );
}
