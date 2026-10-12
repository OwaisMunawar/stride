export type Sample = { x: number; y: number };
export type XY = { x: number; y: number };

export type ChartGeometry = {
  points: XY[];
  minY: number;
  maxY: number;
  /** Pixel y of each horizontal guide, with the data value it marks. */
  guides: { y: number; value: number }[];
};

/**
 * Maps samples into a pixel box. `invert` puts small values at the top, which
 * is what a pace chart needs: a faster (smaller) pace should read as "up".
 * The y range is padded by a fraction so the line never touches the edges,
 * and has a minimum span so a perfectly even run does not render as noise
 * blown up to full height.
 */
export function chartGeometry(
  samples: readonly Sample[],
  box: { width: number; height: number; top?: number; bottom?: number },
  options: { invert?: boolean; minSpan?: number; padding?: number; guides?: number } = {},
): ChartGeometry {
  const top = box.top ?? 0;
  const bottom = box.bottom ?? 0;
  const innerHeight = Math.max(1, box.height - top - bottom);
  if (samples.length === 0) return { points: [], minY: 0, maxY: 0, guides: [] };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
  }
  const minSpan = options.minSpan ?? 1;
  if (maxY - minY < minSpan) {
    const mid = (maxY + minY) / 2;
    minY = mid - minSpan / 2;
    maxY = mid + minSpan / 2;
  }
  const pad = (maxY - minY) * (options.padding ?? 0.12);
  minY -= pad;
  maxY += pad;

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY;
  const toY = (value: number) => {
    const f = (value - minY) / spanY;
    return top + (options.invert ? f : 1 - f) * innerHeight;
  };

  const guideCount = options.guides ?? 3;
  const guides = Array.from({ length: guideCount }, (_, i) => {
    const value = minY + (spanY * (i + 1)) / (guideCount + 1);
    return { y: toY(value), value };
  });

  return {
    points: samples.map((s) => ({ x: ((s.x - minX) / spanX) * box.width, y: toY(s.y) })),
    minY,
    maxY,
    guides,
  };
}

/** Keeps every n-th sample so a chart never draws more vertices than it has pixels. */
export function downsample<T>(samples: readonly T[], maxPoints: number): T[] {
  if (samples.length <= maxPoints || maxPoints < 2) return [...samples];
  const step = (samples.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, i) => samples[Math.round(i * step)]!);
}
