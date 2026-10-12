import { type LiveActivity } from 'expo-widgets';

import { type LiveActivityController } from './LiveActivityController';
import { RunActivity, type RunActivityProps } from './RunActivity';

/**
 * ActivityKit through expo-widgets. A Live Activity outlives the JS process,
 * so on construction any instance left over from a previous launch is adopted
 * rather than duplicated: the engine restores the run and keeps updating the
 * same card on the Lock Screen.
 */
export function createExpoLiveActivity(): LiveActivityController {
  let current: LiveActivity<RunActivityProps> | null =
    safe(() => RunActivity.getInstances()[0]) ?? null;

  return {
    start(props) {
      if (current) {
        void current.update(props).catch(warn);
        return;
      }
      current = safe(() => RunActivity.start(props, 'stride://')) ?? null;
    },
    update(props) {
      void current?.update(props).catch(warn);
    },
    async end(props) {
      const instances = safe(() => RunActivity.getInstances()) ?? [];
      current = null;
      await Promise.all(instances.map((instance) => instance.end('immediate', props).catch(warn)));
    },
  };
}

function safe<T>(work: () => T): T | undefined {
  try {
    return work();
  } catch (error) {
    warn(error);
    return undefined;
  }
}

function warn(error: unknown) {
  console.warn('[live-activity]', error instanceof Error ? error.message : error);
}
