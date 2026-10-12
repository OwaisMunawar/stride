import { type LiveActivityController } from '@/features/recording/live-activity/LiveActivityController';
import { type RunActivityProps } from '@/features/recording/live-activity/types';
import { type FixSink, type LocationSource } from '@/features/recording/location/LocationSource';
import {
  type LocationAccess,
  type LocationPermissions,
} from '@/features/recording/location/permissions';
import { type Fix } from '@/features/tracking/lib/types';

/** A location source driven by the test: push fixes, move the clock. */
export function createManualSource(
  kind: LocationSource['kind'] = 'device',
  startAt = 1_700_000_000_000,
) {
  let sink: FixSink | null = null;
  let now = startAt;
  const source = {
    kind,
    rate: 1,
    started: false,
    now: () => now,
    start: jest.fn(async (next: FixSink) => {
      sink = next;
      source.started = true;
    }),
    stop: jest.fn(async () => {
      source.started = false;
    }),
    async push(fixes: readonly Fix[]) {
      const last = fixes[fixes.length - 1];
      if (last) now = Math.max(now, last.t);
      await sink?.(fixes);
    },
    setNow(value: number) {
      now = value;
    },
  };
  return source satisfies LocationSource;
}

export type ManualSource = ReturnType<typeof createManualSource>;

export function createFakeLiveActivity() {
  const calls: { method: 'start' | 'update' | 'end'; props?: RunActivityProps }[] = [];
  const controller: LiveActivityController = {
    start: (props) => void calls.push({ method: 'start', props }),
    update: (props) => void calls.push({ method: 'update', props }),
    end: async (props) => void calls.push({ method: 'end', props }),
  };
  return { controller, calls };
}

export function createFakePermissions(
  initial: LocationAccess = 'background',
): LocationPermissions & {
  set(access: LocationAccess): void;
} {
  let access = initial;
  return {
    check: async () => access,
    requestForeground: jest.fn(async () => {
      if (access === 'none') access = 'foreground';
      return access;
    }),
    requestBackground: jest.fn(async () => {
      access = 'background';
      return access;
    }),
    openSettings: jest.fn(async () => undefined),
    set(next) {
      access = next;
    },
  };
}

/** Lets queued promise chains (engine queue, sink writes) settle. */
export async function flush(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setImmediate(resolve));
}
