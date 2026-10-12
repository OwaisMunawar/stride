/**
 * Everything is stored in SI (metres, milliseconds, seconds per kilometre) and
 * converted only at the edge, here. Keeping one canonical unit in the database
 * means switching km/mi is a display change, never a migration.
 */
export type UnitSystem = 'metric' | 'imperial';

export const METRES_PER_KM = 1000;
export const METRES_PER_MILE = 1609.344;
const FEET_PER_METRE = 3.280839895;

export function unitLength(system: UnitSystem): number {
  return system === 'metric' ? METRES_PER_KM : METRES_PER_MILE;
}

export function distanceUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'km' : 'mi';
}

export function paceUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? '/km' : '/mi';
}

export function speedUnitLabel(system: UnitSystem): string {
  return system === 'metric' ? 'km/h' : 'mph';
}

export function metresToUnit(metres: number, system: UnitSystem): number {
  return metres / unitLength(system);
}

/** Seconds per kilometre to seconds per display unit. */
export function paceToUnit(secPerKm: number, system: UnitSystem): number {
  return system === 'metric' ? secPerKm : secPerKm * (METRES_PER_MILE / METRES_PER_KM);
}

export function speedToUnit(metresPerSecond: number, system: UnitSystem): number {
  return (metresPerSecond * 3600) / unitLength(system);
}

/** Truncates rather than rounds: "4.99 km" must not read as "5.00 km" before the split buzzes. */
export function formatDistance(metres: number, system: UnitSystem, decimals = 2): string {
  const value = Math.max(0, metresToUnit(metres, system));
  const factor = 10 ** decimals;
  return (Math.floor(value * factor) / factor).toFixed(decimals);
}

export function formatElevation(metres: number, system: UnitSystem): string {
  const value = system === 'metric' ? metres : metres * FEET_PER_METRE;
  return `${Math.round(value)} ${system === 'metric' ? 'm' : 'ft'}`;
}

/** h:mm:ss above an hour, m:ss below, matching what runners read on a watch. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = seconds.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

/** Paces slower than this read as standing still, not as a 47-minute kilometre. */
const SLOWEST_SHOWN_PACE_SEC = 59 * 60 + 59;

export function formatPace(secPerKm: number | null, system: UnitSystem): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) return '--:--';
  const value = Math.round(paceToUnit(secPerKm, system));
  if (value > SLOWEST_SHOWN_PACE_SEC) return '--:--';
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatSpeed(metresPerSecond: number | null, system: UnitSystem): string {
  if (metresPerSecond === null || !Number.isFinite(metresPerSecond) || metresPerSecond < 0) {
    return '--';
  }
  return speedToUnit(metresPerSecond, system).toFixed(1);
}
