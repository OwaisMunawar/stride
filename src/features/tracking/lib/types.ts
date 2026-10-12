export type ActivityType = 'run' | 'ride';

/**
 * One raw reading from a location source, exactly as delivered. Optional
 * fields are null rather than absent because SQLite round-trips them that way
 * and iOS reports "invalid" as -1, which the adapter maps to null.
 */
export type Fix = {
  /** Epoch milliseconds. */
  t: number;
  lat: number;
  lon: number;
  /** Metres above sea level. */
  alt: number | null;
  /** Horizontal 68% confidence radius in metres. */
  accuracy: number | null;
  altitudeAccuracy: number | null;
  /** Ground speed in m/s from the GNSS chip (Doppler), when the device reports one. */
  speed: number | null;
};

/** A filtered, accepted position. `segment` changes whenever the track is broken by a pause. */
export type TrackPoint = {
  t: number;
  lat: number;
  lon: number;
  alt: number | null;
  segment: number;
};

export type LatLon = { lat: number; lon: number };

export type Bounds = { minLat: number; minLon: number; maxLat: number; maxLon: number };

export type Split = {
  /** 1-based. */
  index: number;
  /** Equal to the unit length for full splits; shorter for the trailing partial one. */
  distanceM: number;
  durationMs: number;
  paceSecPerKm: number;
  elevationDeltaM: number;
  partial: boolean;
};
