import * as fc from 'fast-check';

import {
  canTransition,
  isLive,
  transition,
  type MachineEvent,
  type RecordingStatus,
} from '../machine';

const events: MachineEvent[] = [
  'START',
  'PAUSE',
  'RESUME',
  'STOP',
  'MOTION_STOPPED',
  'MOTION_RESUMED',
  'RESET',
];

describe('recording state machine', () => {
  it('follows the documented happy path', () => {
    let status: RecordingStatus = 'idle';
    const path: [MachineEvent, RecordingStatus][] = [
      ['START', 'recording'],
      ['MOTION_STOPPED', 'autoPaused'],
      ['MOTION_RESUMED', 'recording'],
      ['PAUSE', 'paused'],
      ['RESUME', 'recording'],
      ['STOP', 'finished'],
      ['RESET', 'idle'],
    ];
    for (const [event, expected] of path) {
      status = transition(status, event);
      expect(status).toBe(expected);
    }
  });

  it('ignores events that do not apply instead of throwing', () => {
    expect(transition('idle', 'PAUSE')).toBe('idle');
    expect(transition('paused', 'MOTION_RESUMED')).toBe('paused');
    expect(transition('finished', 'START')).toBe('finished');
    expect(transition('autoPaused', 'PAUSE')).toBe('paused');
    expect(canTransition('recording', 'RESUME')).toBe(false);
    expect(canTransition('autoPaused', 'STOP')).toBe(true);
  });

  it('only finishes through STOP and only starts from idle (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...events), { maxLength: 40 }), (sequence) => {
        let status: RecordingStatus = 'idle';
        for (const event of sequence) {
          const next = transition(status, event);
          if (next === 'finished' && status !== 'finished') expect(event).toBe('STOP');
          if (status === 'idle' && next !== 'idle') expect(event).toBe('START');
          // Auto-pause can only resume into recording, never skip to finished.
          if (status === 'autoPaused' && event === 'MOTION_RESUMED') expect(next).toBe('recording');
          status = next;
        }
      }),
    );
  });

  it('reports which states are live', () => {
    expect(
      ['idle', 'recording', 'paused', 'autoPaused', 'finished'].map((s) =>
        isLive(s as RecordingStatus),
      ),
    ).toEqual([false, true, true, true, false]);
  });
});
