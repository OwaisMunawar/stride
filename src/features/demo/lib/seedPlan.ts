import { generateTrack, type TrackPlan } from './generateTrack';
import { seededRandom } from './random';
import {
  CRISSY_FIELD,
  EMBARCADERO,
  GOLDEN_GATE_PARK,
  WATERFRONT_RIDE,
  type DemoRoute,
} from './routes';

type Entry = {
  daysAgo: number;
  hour: number;
  minute: number;
  route: DemoRoute;
  km: number;
  pace: string;
  trend: number;
  stops?: TrackPlan['stops'];
};

/**
 * Ten fictional sessions over three and a half weeks: a steady base of easy
 * runs, one long run, a faster tempo, two rides, a couple of crossings to wait
 * at, and a two-day streak going into today. Enough variety that the weekly
 * chart, the streak and every branch of the rule-based coach show something.
 */
const ENTRIES: readonly Entry[] = [
  { daysAgo: 23, hour: 7, minute: 5, route: CRISSY_FIELD, km: 5.2, pace: '6:02', trend: 0.04 },
  {
    daysAgo: 20,
    hour: 18,
    minute: 20,
    route: EMBARCADERO,
    km: 6.1,
    pace: '5:51',
    trend: 0.02,
    stops: [{ atM: 2300, seconds: 25 }],
  },
  { daysAgo: 17, hour: 8, minute: 40, route: WATERFRONT_RIDE, km: 16.4, pace: '2:28', trend: 0.03 },
  { daysAgo: 15, hour: 7, minute: 15, route: GOLDEN_GATE_PARK, km: 8.4, pace: '5:58', trend: 0.05 },
  { daysAgo: 12, hour: 6, minute: 50, route: CRISSY_FIELD, km: 5.0, pace: '5:31', trend: -0.04 },
  {
    daysAgo: 9,
    hour: 9,
    minute: 30,
    route: GOLDEN_GATE_PARK,
    km: 12.1,
    pace: '6:07',
    trend: 0.06,
    stops: [{ atM: 6100, seconds: 40 }],
  },
  { daysAgo: 7, hour: 18, minute: 5, route: EMBARCADERO, km: 5.5, pace: '5:44', trend: 0.0 },
  {
    daysAgo: 5,
    hour: 8,
    minute: 10,
    route: WATERFRONT_RIDE,
    km: 21.3,
    pace: '2:21',
    trend: 0.02,
    stops: [{ atM: 9000, seconds: 30 }],
  },
  { daysAgo: 2, hour: 7, minute: 0, route: CRISSY_FIELD, km: 6.4, pace: '5:39', trend: -0.02 },
  {
    daysAgo: 1,
    hour: 17,
    minute: 45,
    route: EMBARCADERO,
    km: 7.2,
    pace: '5:26',
    trend: -0.05,
    stops: [{ atM: 3100, seconds: 20 }],
  },
];

export function demoPlans(now: number): TrackPlan[] {
  return ENTRIES.map((entry) => {
    const start = new Date(now);
    start.setDate(start.getDate() - entry.daysAgo);
    start.setHours(entry.hour, entry.minute, 0, 0);
    const [minutes = '6', seconds = '0'] = entry.pace.split(':');
    return {
      route: entry.route,
      startedAt: start.getTime(),
      distanceM: entry.km * 1000,
      paceSecPerKm: Number(minutes) * 60 + Number(seconds),
      trend: entry.trend,
      stops: entry.stops,
      withSpeed: true,
    };
  });
}

/** Each plan gets its own seed, so adding an entry never changes the others. */
export function demoTracks(now: number) {
  return demoPlans(now).map((plan, index) => ({
    plan,
    fixes: generateTrack(plan, seededRandom(0x5eed + index * 7919)),
  }));
}
