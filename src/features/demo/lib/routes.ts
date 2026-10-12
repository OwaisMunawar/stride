import { type ActivityType, type LatLon } from '@/features/tracking/lib/types';

/**
 * Fictional activities along real, public paths in San Francisco. Waypoints
 * are approximate (a few hundred metres apart, following the waterfront
 * promenade and the park drive) so generated tracks sit near the paths on the
 * map instead of cutting through buildings. No real person's data.
 */
export type DemoRoute = {
  id: string;
  name: string;
  activity: ActivityType;
  /** Out-and-back routes are run to the end and back along the same line. */
  outAndBack: boolean;
  /** Baseline altitude and gentle relief, in metres. */
  baseAltitudeM: number;
  reliefM: number;
  waypoints: readonly LatLon[];
};

const p = (lat: number, lon: number): LatLon => ({ lat, lon });

export const CRISSY_FIELD: DemoRoute = {
  id: 'crissy',
  name: 'Crissy Field to Fort Point',
  activity: 'run',
  outAndBack: true,
  baseAltitudeM: 4,
  reliefM: 3,
  waypoints: [
    p(37.80629, -122.43885),
    p(37.80676, -122.44263),
    p(37.80588, -122.44659),
    p(37.80482, -122.45048),
    p(37.80416, -122.45453),
    p(37.80399, -122.45875),
    p(37.80451, -122.46281),
    p(37.80548, -122.46661),
    p(37.80688, -122.46998),
    p(37.80794, -122.47235),
    p(37.80904, -122.47468),
    p(37.81022, -122.47665),
  ],
};

export const EMBARCADERO: DemoRoute = {
  id: 'embarcadero',
  name: 'Embarcadero',
  activity: 'run',
  outAndBack: true,
  baseAltitudeM: 3,
  reliefM: 2,
  waypoints: [
    p(37.77863, -122.38842),
    p(37.78216, -122.38783),
    p(37.78591, -122.38807),
    p(37.78903, -122.38855),
    p(37.79237, -122.39056),
    p(37.79561, -122.39331),
    p(37.79823, -122.39613),
    p(37.80064, -122.39893),
    p(37.80301, -122.40188),
    p(37.80536, -122.40476),
    p(37.80748, -122.40829),
    p(37.80863, -122.41171),
  ],
};

export const GOLDEN_GATE_PARK: DemoRoute = {
  id: 'ggpark',
  name: 'Golden Gate Park, JFK Promenade',
  activity: 'run',
  outAndBack: true,
  baseAltitudeM: 60,
  reliefM: 18,
  waypoints: [
    p(37.77152, -122.45486),
    p(37.77203, -122.45837),
    p(37.77182, -122.46224),
    p(37.77131, -122.46612),
    p(37.77085, -122.46992),
    p(37.77048, -122.47388),
    p(37.77012, -122.47797),
    p(37.76993, -122.48213),
    p(37.77002, -122.48627),
    p(37.77019, -122.49045),
    p(37.77033, -122.49462),
    p(37.76997, -122.49875),
    p(37.76958, -122.50291),
  ],
};

export const WATERFRONT_RIDE: DemoRoute = {
  id: 'waterfront-ride',
  name: 'Waterfront ride',
  activity: 'ride',
  outAndBack: true,
  baseAltitudeM: 5,
  reliefM: 6,
  waypoints: [
    ...EMBARCADERO.waypoints,
    // Fisherman's Wharf, Aquatic Park and Fort Mason link the two promenades.
    p(37.80811, -122.41604),
    p(37.80776, -122.42051),
    p(37.80689, -122.42477),
    p(37.80614, -122.42902),
    p(37.80603, -122.43379),
    ...CRISSY_FIELD.waypoints,
  ],
};

export const DEMO_ROUTES = [CRISSY_FIELD, EMBARCADERO, GOLDEN_GATE_PARK, WATERFRONT_RIDE] as const;
