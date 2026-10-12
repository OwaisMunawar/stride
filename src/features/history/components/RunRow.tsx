import { memo } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme';
import { Icon, ScalePressable, Text } from '@/core/ui';
import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  type UnitSystem,
} from '@/core/units/units';
import { primaryRate } from '@/features/recording/lib/liveStats';

import { type RunRecord } from '../model';
import { RouteThumbnail } from './RouteThumbnail';

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const RunRow = memo(function RunRow({
  run,
  units,
  onPress,
}: {
  run: RunRecord;
  units: UnitSystem;
  onPress: (id: string) => void;
}) {
  const { colors, spacing, radii } = useTheme();
  const rate = primaryRate(run.activity, run.summary.avgPaceSecPerKm, units);
  const distance = `${formatDistance(run.summary.distanceM, units)} ${distanceUnitLabel(units)}`;

  return (
    <ScalePressable
      testID={`run-row-${run.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${run.title}, ${distance}, ${formatDuration(run.summary.movingMs)}`}
      pressedScale={0.985}
      onPress={() => onPress(run.id)}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <RouteThumbnail thumbnail={run.thumbnail} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon
            name={run.activity === 'ride' ? 'ride' : 'run'}
            size={13}
            color={colors.textMuted}
          />
          <Text variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
            {run.title}
          </Text>
        </View>
        <Text variant="caption" color="textFaint">
          {dateFormat.format(run.startedAt)}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxs }}>
          <Text variant="callout" tabular>
            {distance}
          </Text>
          <Text variant="callout" color="textMuted" tabular>
            {`${rate.value} ${rate.label}`}
          </Text>
          <Text variant="callout" color="textMuted" tabular>
            {formatDuration(run.summary.movingMs)}
          </Text>
        </View>
      </View>
      <Icon name="chevronRight" size={13} color={colors.textFaint} />
    </ScalePressable>
  );
});
