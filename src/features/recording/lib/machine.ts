/**
 * The recording lifecycle as an explicit state machine.
 *
 *   idle ──START──▶ recording ◀──RESUME── paused
 *                    │  ▲  │                ▲
 *       MOTION_STOPPED  │  └─────PAUSE──────┤
 *                    ▼  MOTION_RESUMED      │
 *                  autoPaused ───PAUSE──────┘
 *
 *   recording | paused | autoPaused ──STOP──▶ finished ──RESET──▶ idle
 *
 * Anything not in the table is ignored rather than thrown: a double tap on
 * Pause, or a motion event that lands after the user already paused, must
 * never crash a run in progress.
 */
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'autoPaused' | 'finished';

export type MachineEvent =
  'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'MOTION_STOPPED' | 'MOTION_RESUMED' | 'RESET';

const table: Record<RecordingStatus, Partial<Record<MachineEvent, RecordingStatus>>> = {
  idle: { START: 'recording' },
  recording: { PAUSE: 'paused', MOTION_STOPPED: 'autoPaused', STOP: 'finished' },
  autoPaused: { MOTION_RESUMED: 'recording', PAUSE: 'paused', STOP: 'finished' },
  paused: { RESUME: 'recording', STOP: 'finished' },
  finished: { RESET: 'idle' },
};

export function transition(status: RecordingStatus, event: MachineEvent): RecordingStatus {
  return table[status][event] ?? status;
}

export function canTransition(status: RecordingStatus, event: MachineEvent): boolean {
  return table[status][event] !== undefined;
}

/** True while a run exists that has not been finished. */
export function isLive(status: RecordingStatus): boolean {
  return status === 'recording' || status === 'paused' || status === 'autoPaused';
}
