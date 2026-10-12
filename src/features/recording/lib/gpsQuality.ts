export type GpsQuality = 'searching' | 'poor' | 'fair' | 'good';

/** No fix for this long means the signal is gone, whatever the last accuracy said. */
const STALE_AFTER_MS = 10_000;

/**
 * Bands follow what the filter actually does with a fix: under 10 m it is
 * trusted almost fully, up to 25 m it is blended, beyond that the outlier
 * gate starts dropping fixes and distance will undercount.
 */
export function gpsQuality(
  lastFix: { t: number; accuracy: number | null } | null,
  now: number,
): GpsQuality {
  if (!lastFix || now - lastFix.t > STALE_AFTER_MS) return 'searching';
  if (lastFix.accuracy === null) return 'fair';
  if (lastFix.accuracy <= 10) return 'good';
  if (lastFix.accuracy <= 25) return 'fair';
  return 'poor';
}
