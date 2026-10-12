import { useEffect, useState } from 'react';

import { useServices } from '@/composition/ServicesProvider';
import { useStore } from '@/core/hooks/useStore';

import { liveStats } from '../lib/liveStats';

/**
 * The live recording for screens: the engine's snapshot plus stats computed
 * against a ticking clock. The tick is what keeps the timer moving between
 * fixes; it only runs while something is being recorded.
 */
export function useRecording() {
  const { engine } = useServices();
  const snapshot = useStore(engine.snapshot);
  const live = snapshot !== null;
  const now = useTicker(live ? (snapshot.clockRate > 1 ? 250 : 500) : null, engine.now);

  return {
    snapshot,
    stats: snapshot ? liveStats(snapshot.session, snapshot.points, now) : null,
    now,
    engine,
  };
}

function useTicker(intervalMs: number | null, clock: () => number): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (intervalMs === null) return;
    const handle = setInterval(() => setNow(clock()), intervalMs);
    return () => clearInterval(handle);
  }, [intervalMs, clock]);
  return now;
}
