import { View } from 'react-native';

import { useTheme } from '@/core/theme';
import { Metric, Text } from '@/core/ui';
import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  formatPace,
  paceUnitLabel,
  type UnitSystem,
} from '@/core/units/units';
import { type ActivityType, type Split } from '@/features/tracking/lib/types';

import { type LiveStats, primaryRate } from '../lib/liveStats';

/**
 * The live numbers. Time is the hero because it is the one thing glanced at
 * every few seconds; distance and pace sit beneath at equal weight, and the
 * last full split confirms the haptic buzz the runner just felt.
 */
export function LiveStatsPanel({
  stats,
  activity,
  units,
  lastSplit,
}: {
  stats: LiveStats;
  activity: ActivityType;
  units: UnitSystem;
  lastSplit: Split | null;
}) {
  const { spacing, colors, radii } = useTheme();
  const current = primaryRate(activity, stats.currentPaceSecPerKm, units);
  const average = primaryRate(activity, stats.avgPaceSecPerKm, units);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center' }}>
        <Text variant="overline" color="textFaint">
          Moving time
        </Text>
        <Text variant="hero" tabular testID="live-time" accessibilityLabel="Moving time">
          {formatDuration(stats.movingMs)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Metric
          testID="live-distance"
          label="Distance"
          value={formatDistance(stats.distanceM, units)}
          unit={distanceUnitLabel(units)}
          style={{ flex: 1 }}
        />
        <Metric
          testID="live-pace"
          label={activity === 'ride' ? 'Speed' : 'Pace'}
          value={current.value}
          unit={current.label}
          style={{ flex: 1 }}
        />
        <Metric label="Average" value={average.value} unit={average.label} style={{ flex: 1 }} />
      </View>
      {lastSplit ? (
        <View
          testID="last-split"
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceSunken,
          }}>
          <Text variant="caption" color="textMuted">
            {`${units === 'metric' ? 'Km' : 'Mile'} ${lastSplit.index} split`}
          </Text>
          <Text variant="callout" tabular>
            {`${formatPace(lastSplit.paceSecPerKm, units)} ${paceUnitLabel(units)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
