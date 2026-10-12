import { type RunActivityProps } from './types';

/**
 * The Lock Screen / Dynamic Island surface, behind an interface so the engine
 * does not know about ActivityKit. Android uses the no-op implementation; its
 * equivalent is the foreground-service notification, which the OS owns.
 *
 * Implementations never throw: a user who disabled Live Activities in Settings
 * must still be able to record.
 */
export interface LiveActivityController {
  start(props: RunActivityProps): void;
  update(props: RunActivityProps): void;
  end(props?: RunActivityProps): Promise<void>;
}

export const noopLiveActivity: LiveActivityController = {
  start: () => undefined,
  update: () => undefined,
  end: async () => undefined,
};
