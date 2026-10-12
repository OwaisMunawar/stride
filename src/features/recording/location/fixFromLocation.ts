import { type Fix } from '@/features/tracking/lib/types';

/** The subset of expo-location's LocationObject we read, kept structural for tests. */
export type LocationLike = {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
    speed: number | null;
  };
};

/** iOS reports "unknown" as a negative number; Android omits the field. Both become null. */
const valid = (value: number | null | undefined): number | null =>
  value === null || value === undefined || !Number.isFinite(value) || value < 0 ? null : value;

export function fixFromLocation(location: LocationLike): Fix {
  const { coords } = location;
  return {
    t: Math.round(location.timestamp),
    lat: coords.latitude,
    lon: coords.longitude,
    // Altitude may legitimately be negative (Dead Sea, Dutch polders), so only
    // reject non-finite values here.
    alt: coords.altitude !== null && Number.isFinite(coords.altitude) ? coords.altitude : null,
    accuracy: valid(coords.accuracy),
    altitudeAccuracy: valid(coords.altitudeAccuracy),
    speed: valid(coords.speed),
  };
}
