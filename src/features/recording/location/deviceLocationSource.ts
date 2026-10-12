import * as Location from 'expo-location';

import { AppError, toAppError } from '@/core/errors/AppError';
import { type ActivityType } from '@/features/tracking/lib/types';

import { LOCATION_TASK } from './backgroundTask';
import { type LocationSource } from './LocationSource';

/**
 * The real GPS, through a registered background task. `start` ignores the
 * sink it is given: fixes reach the app through the task handler, which runs
 * whether the screen is on, locked, or the app is in the background, and
 * writes into the same sink the composition root wires up.
 */
export function createDeviceLocationSource(activity: () => ActivityType): LocationSource {
  return {
    kind: 'device',
    rate: 1,
    now: () => Date.now(),
    async start() {
      if (!(await Location.hasServicesEnabledAsync())) {
        throw new AppError('LOCATION_SERVICES_OFF', 'Location services are turned off');
      }
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          // Every fix, not every N metres: auto-pause needs to see standing still.
          distanceInterval: 0,
          timeInterval: 1000,
          activityType:
            activity() === 'ride'
              ? Location.ActivityType.OtherNavigation
              : Location.ActivityType.Fitness,
          // iOS must not decide on its own that the run is over.
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Stride is recording',
            notificationBody: 'Your route is being tracked. Open Stride to pause or finish.',
            notificationColor: '#FF5A1F',
            killServiceOnDestroy: false,
          },
        });
      } catch (error) {
        throw toAppError(error, 'LOCATION_START_FAILED');
      }
    },
    async stop() {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
    },
  };
}
