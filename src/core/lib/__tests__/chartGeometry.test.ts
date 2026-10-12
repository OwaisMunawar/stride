import { chartGeometry, downsample } from '../chartGeometry';

describe('chartGeometry', () => {
  const samples = [
    { x: 0, y: 300 },
    { x: 5, y: 250 },
    { x: 10, y: 350 },
  ];

  it('spans the width and keeps values inside the box', () => {
    const { points, guides } = chartGeometry(samples, {
      width: 200,
      height: 100,
      top: 10,
      bottom: 10,
    });
    expect(points.map((p) => p.x)).toEqual([0, 100, 200]);
    for (const p of points) {
      expect(p.y).toBeGreaterThan(10);
      expect(p.y).toBeLessThan(90);
    }
    // Larger values are higher up (smaller y) by default.
    expect(points[2]!.y).toBeLessThan(points[1]!.y);
    expect(guides).toHaveLength(3);
  });

  it('inverts for pace, where smaller is better and goes on top', () => {
    const { points } = chartGeometry(
      samples,
      { width: 200, height: 100 },
      { invert: true, guides: 2 },
    );
    expect(points[1]!.y).toBeLessThan(points[2]!.y);
  });

  it('applies a minimum span so a flat line does not blow up noise', () => {
    const flat = [
      { x: 0, y: 300 },
      { x: 1, y: 301 },
    ];
    const { minY, maxY } = chartGeometry(
      flat,
      { width: 100, height: 100 },
      { minSpan: 20, padding: 0 },
    );
    expect(maxY - minY).toBe(20);
  });

  it('handles empty input and single samples', () => {
    expect(chartGeometry([], { width: 1, height: 1 }).points).toEqual([]);
    expect(chartGeometry([{ x: 3, y: 3 }], { width: 10, height: 10 }).points).toHaveLength(1);
  });
});

describe('downsample', () => {
  it('keeps the ends and caps the count', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i);
    const result = downsample(data, 50);
    expect(result).toHaveLength(50);
    expect(result[0]).toBe(0);
    expect(result.at(-1)).toBe(999);
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
    expect(downsample([1, 2, 3], 1)).toEqual([1, 2, 3]);
  });
});
