import { View } from 'react-native';

import { paceRamp, useTheme } from '@/core/theme';
import { Text } from '@/core/ui';
import { formatElevation, formatPace, type UnitSystem } from '@/core/units/units';
import { type Split } from '@/features/tracking/lib/types';

/**
 * Splits with a bar per row, longer for faster, coloured on the same ramp as
 * the route on the map so a fast kilometre is the same colour in both places.
 */
export function SplitsTable({ splits, units }: { splits: readonly Split[]; units: UnitSystem }) {
  const { colors, spacing, radii } = useTheme();
  const full = splits.filter((s) => !s.partial);
  const paces = full.map((s) => s.paceSecPerKm);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const unit = units === 'metric' ? 'Km' : 'Mi';

  return (
    <View style={{ gap: spacing.xs }} testID="splits-table">
      <View style={{ flexDirection: 'row', paddingBottom: spacing.xs }}>
        <Text variant="overline" color="textFaint" style={{ width: 36 }}>
          {unit}
        </Text>
        <Text variant="overline" color="textFaint" style={{ width: 64 }}>
          Pace
        </Text>
        <View style={{ flex: 1 }} />
        <Text variant="overline" color="textFaint" style={{ width: 60, textAlign: 'right' }}>
          Elev
        </Text>
      </View>
      {splits.map((split) => {
        const rank =
          split.partial || slowest === fastest
            ? 0.5
            : (slowest - split.paceSecPerKm) / (slowest - fastest);
        const color = paceRamp[Math.round(Math.max(0, Math.min(1, rank)) * (paceRamp.length - 1))]!;
        return (
          <View
            key={split.index}
            accessible
            accessibilityLabel={`${unit} ${split.index}, ${formatPace(split.paceSecPerKm, units)}`}
            style={{ flexDirection: 'row', alignItems: 'center', height: 30 }}>
            <Text variant="callout" tabular color="textMuted" style={{ width: 36 }}>
              {split.partial
                ? `${(split.distanceM / (units === 'metric' ? 1000 : 1609.344)).toFixed(1)}`
                : split.index}
            </Text>
            <Text variant="callout" tabular style={{ width: 64 }}>
              {formatPace(split.paceSecPerKm, units)}
            </Text>
            <View
              style={{
                flex: 1,
                height: 10,
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceSunken,
              }}>
              <View
                style={{
                  width: `${Math.round(35 + rank * 65)}%`,
                  height: '100%',
                  borderRadius: radii.pill,
                  backgroundColor: color,
                }}
              />
            </View>
            <Text
              variant="caption"
              tabular
              color="textMuted"
              style={{ width: 60, textAlign: 'right' }}>
              {`${split.elevationDeltaM >= 0 ? '+' : '−'}${formatElevation(Math.abs(split.elevationDeltaM), units)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
