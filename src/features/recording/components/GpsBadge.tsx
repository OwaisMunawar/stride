import { Pill, type PillTone } from '@/core/ui';

import { type GpsQuality } from '../lib/gpsQuality';

const LABELS: Record<GpsQuality, { label: string; tone: PillTone }> = {
  searching: { label: 'Searching for GPS', tone: 'warning' },
  poor: { label: 'GPS weak', tone: 'danger' },
  fair: { label: 'GPS fair', tone: 'warning' },
  good: { label: 'GPS good', tone: 'success' },
};

export function GpsBadge({
  quality,
  accuracyM,
}: {
  quality: GpsQuality;
  accuracyM: number | null;
}) {
  const { label, tone } = LABELS[quality];
  const suffix =
    quality !== 'searching' && accuracyM !== null ? ` · ±${Math.round(accuracyM)} m` : '';
  return <Pill testID="gps-badge" icon="location" tone={tone} label={`${label}${suffix}`} />;
}
