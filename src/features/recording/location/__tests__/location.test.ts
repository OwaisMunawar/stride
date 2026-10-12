import { straightFixes } from '@/test-utils/tracks';

import { fixFromLocation } from '../fixFromLocation';
import { createReplayLocationSource, type Scheduler } from '../replayLocationSource';

describe('fixFromLocation', () => {
  it('maps a location object and nulls invalid readings', () => {
    expect(
      fixFromLocation({
        timestamp: 1000.4,
        coords: {
          latitude: 1,
          longitude: 2,
          altitude: -12,
          accuracy: 5,
          altitudeAccuracy: -1,
          speed: -1,
        },
      }),
    ).toEqual({
      t: 1000,
      lat: 1,
      lon: 2,
      alt: -12,
      accuracy: 5,
      altitudeAccuracy: null,
      speed: null,
    });

    expect(
      fixFromLocation({
        timestamp: 0,
        coords: {
          latitude: 0,
          longitude: 0,
          altitude: null,
          accuracy: null,
          altitudeAccuracy: null,
          speed: 3,
        },
      }),
    ).toMatchObject({ alt: null, accuracy: null, speed: 3 });
  });
});

function fakeScheduler() {
  let callback: (() => void) | null = null;
  const scheduler: Scheduler = {
    setInterval: (cb) => {
      callback = cb;
      return 1;
    },
    clearInterval: () => {
      callback = null;
    },
  };
  return { scheduler, tick: () => callback?.(), active: () => callback !== null };
}

describe('createReplayLocationSource', () => {
  it('replays fixes at 10x on a virtual clock that keeps their real spacing', async () => {
    const track = straightFixes({ speedMps: 3, seconds: 100, startT: 5_000_000 });
    let wall = 1_000_000;
    const { scheduler, tick, active } = fakeScheduler();
    const onFinished = jest.fn();
    const source = createReplayLocationSource({
      track,
      rate: 10,
      wallClock: () => wall,
      scheduler,
      onFinished,
    });
    const received: number[] = [];
    expect(source.now()).toBe(wall);
    await source.start(async (fixes) => void received.push(...fixes.map((f) => f.t)));
    await source.start(async () => undefined);

    wall += 2_000; // 2 s of wall time = 20 s of track
    tick();
    expect(received).toHaveLength(21);
    expect(received[1]! - received[0]!).toBe(1000);
    expect(received[0]).toBe(1_000_000);
    expect(source.now()).toBe(1_020_000);

    wall += 10_000;
    tick();
    tick();
    expect(received).toHaveLength(track.length);
    expect(onFinished).toHaveBeenCalledTimes(1);

    await source.stop();
    expect(active()).toBe(false);
    const frozen = source.now();
    wall += 1_000;
    // Once stopped the clock runs at real speed from where the replay was.
    expect(source.now()).toBe(frozen + 1_000);
    await source.stop();
  });
});
