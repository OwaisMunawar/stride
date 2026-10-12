import {
  breakSegment,
  ingestFix,
  initialTracker,
  type TrackerConfig,
  type TrackerState,
} from '@/features/tracking/lib/tracker';
import { type Fix, type TrackPoint } from '@/features/tracking/lib/types';

import { transition, type MachineEvent, type RecordingStatus } from './machine';

export type Command = 'start' | 'pause' | 'resume' | 'stop';

export type SessionInput =
  { type: 'command'; command: Command; at: number } | { type: 'fix'; fix: Fix };

export type SessionConfig = {
  tracker: TrackerConfig;
  /** Split length for split events (haptics). 1000 or 1609.344. */
  splitUnitM: number;
};

/**
 * A recording session is a pure fold over two streams persisted in SQLite:
 * user commands and location fixes. Because nothing else feeds it, the live
 * state after an app restart is simply the same fold replayed, and tests can
 * drive the whole pipeline with plain arrays.
 */
export type SessionState = {
  status: RecordingStatus;
  startedAt: number | null;
  endedAt: number | null;
  /** Moving time in closed recording intervals. */
  activeMs: number;
  /** Start of the open recording interval, while status is `recording`. */
  resumedAt: number | null;
  tracker: TrackerState;
  splitsAnnounced: number;
};

export const initialSession: SessionState = {
  status: 'idle',
  startedAt: null,
  endedAt: null,
  activeMs: 0,
  resumedAt: null,
  tracker: initialTracker,
  splitsAnnounced: 0,
};

export type SessionEffect =
  | { type: 'point'; point: TrackPoint }
  | { type: 'status'; status: RecordingStatus; at: number }
  | { type: 'split'; index: number };

const COMMAND_EVENTS: Record<Command, MachineEvent> = {
  start: 'START',
  pause: 'PAUSE',
  resume: 'RESUME',
  stop: 'STOP',
};

export function reduceSession(
  state: SessionState,
  input: SessionInput,
  config: SessionConfig,
): { state: SessionState; effects: SessionEffect[] } {
  if (input.type === 'command') return applyCommand(state, input.command, input.at);

  if (state.status !== 'recording' && state.status !== 'autoPaused') {
    // Fixes keep arriving while manually paused (stopping the GPS would lose
    // the lock); they are simply not part of the run.
    return { state, effects: [] };
  }

  const step = ingestFix(state.tracker, input.fix, config.tracker, state.status === 'autoPaused');
  let next: SessionState = { ...state, tracker: step.state };
  const effects: SessionEffect[] = [];

  if (step.motion?.type === 'resumed') {
    next = retime(next, 'MOTION_RESUMED', step.motion.at);
    effects.push({ type: 'status', status: next.status, at: step.motion.at });
  }
  if (step.point) {
    effects.push({ type: 'point', point: step.point });
    const completed = Math.floor(next.tracker.distanceM / config.splitUnitM);
    for (let index = next.splitsAnnounced + 1; index <= completed; index++) {
      effects.push({ type: 'split', index });
    }
    next = { ...next, splitsAnnounced: Math.max(next.splitsAnnounced, completed) };
  }
  if (step.motion?.type === 'stopped') {
    next = retime(next, 'MOTION_STOPPED', step.motion.at);
    effects.push({ type: 'status', status: next.status, at: step.motion.at });
  }
  return { state: next, effects };
}

function applyCommand(
  state: SessionState,
  command: Command,
  at: number,
): { state: SessionState; effects: SessionEffect[] } {
  const event = COMMAND_EVENTS[command];
  const status = transition(state.status, event);
  if (status === state.status) return { state, effects: [] };

  let next = retime(state, event, at);
  if (command === 'start') next = { ...next, startedAt: at };
  if (command === 'stop') next = { ...next, endedAt: at };
  if (command === 'pause') next = { ...next, tracker: breakSegment(next.tracker) };
  return { state: next, effects: [{ type: 'status', status: next.status, at }] };
}

/** Applies a machine transition and closes or opens the moving-time interval. */
function retime(state: SessionState, event: MachineEvent, at: number): SessionState {
  const status = transition(state.status, event);
  if (status === state.status) return state;
  let { activeMs, resumedAt } = state;
  if (state.status === 'recording' && resumedAt !== null) {
    // Auto-pause is back-dated to when the slowdown began, which can be before
    // the interval opened if the athlete stopped right after resuming.
    activeMs += Math.max(0, at - resumedAt);
    resumedAt = null;
  }
  if (status === 'recording') resumedAt = at;
  return { ...state, status, activeMs, resumedAt };
}

/** Moving time at `now`, including the open interval. */
export function movingMsAt(state: SessionState, now: number): number {
  const open = state.status === 'recording' && state.resumedAt !== null ? now - state.resumedAt : 0;
  return state.activeMs + Math.max(0, open);
}

/**
 * Replays persisted inputs. Commands sort before fixes at the same
 * millisecond so a fix stamped exactly at "start" is part of the run.
 */
export function replaySession(
  inputs: readonly SessionInput[],
  config: SessionConfig,
  from: SessionState = initialSession,
): { state: SessionState; points: TrackPoint[] } {
  const ordered = [...inputs].sort((a, b) => {
    const ta = a.type === 'command' ? a.at : a.fix.t;
    const tb = b.type === 'command' ? b.at : b.fix.t;
    if (ta !== tb) return ta - tb;
    return (a.type === 'command' ? 0 : 1) - (b.type === 'command' ? 0 : 1);
  });
  let state = from;
  const points: TrackPoint[] = [];
  for (const input of ordered) {
    const result = reduceSession(state, input, config);
    state = result.state;
    for (const effect of result.effects) if (effect.type === 'point') points.push(effect.point);
  }
  return { state, points };
}
