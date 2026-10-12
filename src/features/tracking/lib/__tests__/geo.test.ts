import * as fc from 'fast-check';

import { boundsOf, haversine, lerp, metresPerDegree, offset } from '../geo';

const latLon = fc.record({
  lat: fc.double({ min: -80, max: 80, noNaN: true }),
  lon: fc.double({ min: -179, max: 179, noNaN: true }),
});

describe('haversine', () => {
  it('matches known distances', () => {
    // Ferry Building to the Golden Gate Bridge toll plaza: about 8.0 km in a straight line.
    const ferry = { lat: 37.7955, lon: -122.3937 };
    const bridge = { lat: 37.8077, lon: -122.475 };
    expect(haversine(ferry, bridge) / 1000).toBeCloseTo(7.27, 1);
    // One degree of latitude is ~111.2 km everywhere.
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -2);
  });

  it('is zero, symmetric and obeys the triangle inequality', () => {
    fc.assert(
      fc.property(latLon, latLon, latLon, (a, b, c) => {
        expect(haversine(a, a)).toBe(0);
        expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
        expect(haversine(a, c)).toBeLessThanOrEqual(haversine(a, b) + haversine(b, c) + 1e-6);
      }),
    );
  });
});

describe('offset and metresPerDegree', () => {
  it('moves by the requested metres', () => {
    fc.assert(
      fc.property(
        latLon,
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        fc.double({ min: -2000, max: 2000, noNaN: true }),
        (origin, east, north) => {
          const moved = offset(origin, east, north);
          expect(haversine(origin, moved)).toBeCloseTo(Math.hypot(east, north), -1);
        },
      ),
    );
    expect(metresPerDegree(60).lon).toBeCloseTo(metresPerDegree(0).lon / 2, 0);
  });
});

describe('boundsOf and lerp', () => {
  it('returns null for no points and a box otherwise', () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { lat: 1, lon: 5 },
        { lat: -2, lon: 7 },
        { lat: 0, lon: 4 },
      ]),
    ).toEqual({ minLat: -2, minLon: 4, maxLat: 1, maxLon: 7 });
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
});
