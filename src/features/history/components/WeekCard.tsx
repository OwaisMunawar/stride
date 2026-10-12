import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme';
import { Card, Icon, Metric, Text } from '@/core/ui';
import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  type UnitSystem,
} from '@/core/units/units';

import { type WeekTotals } from '../lib/weekly';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week at a glance: totals, a seven-day bar chart and the current streak. */
export function WeekCard({
  week,
  previousDistanceM,
  streak,
  todayIndex,
  units,
}: {
  week: WeekTotals;
  previousDistanceM: number;
  streak: number;
  /** 0 for Monday. */
  todayIndex: number;
  units: UnitSystem;
}) {
  const { colors, spacing } = useTheme();
  const [width, setWidth] = useState(0);
  const chartHeight = 64;
  const max = Math.max(...week.days, 1);
  const barWidth = width > 0 ? (width - spacing.sm * 6) / 7 : 0;
  // A percentage against a full week reads as a collapse every Monday, so the
  // card states last week's total and lets the bars tell the story.
  const lastWeek =
    previousDistanceM > 0
      ? `Last week ${formatDistance(previousDistanceM, units, 1)} ${distanceUnitLabel(units)}`
      : null;

  return (
    <Card testID="week-card" style={{ gap: spacing.lg }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: spacing.xxs }}>
          <Text variant="overline" color="textFaint">
            This week
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            <Text variant="display" tabular testID="week-distance">
              {formatDistance(week.distanceM, units, 1)}
            </Text>
            <Text variant="callout" color="textMuted">
              {distanceUnitLabel(units)}
            </Text>
          </View>
          {lastWeek ? (
            <Text variant="caption" color="textMuted">
              {lastWeek}
            </Text>
          ) : null}
        </View>
        <View
          testID="streak"
          accessible
          accessibilityLabel={`${streak} day streak`}
          style={{ alignItems: 'center', gap: spacing.xxs }}>
          <Icon name="flame" size={22} color={streak > 0 ? colors.accent : colors.textFaint} />
          <Text variant="headline" tabular>
            {streak}
          </Text>
          <Text variant="caption" color="textFaint">
            day streak
          </Text>
        </View>
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel="Distance per day this week">
        <Canvas style={{ width, height: chartHeight }}>
          {week.days.map((distance, i) => {
            const h = Math.max(4, (distance / max) * chartHeight);
            return (
              <RoundedRect
                key={i}
                x={i * (barWidth + spacing.sm)}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                r={4}
                color={distance > 0 ? colors.accent : colors.surfaceSunken}
                opacity={i === todayIndex || distance === 0 ? 1 : 0.75}
              />
            );
          })}
        </Canvas>
        <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
          {DAY_LABELS.map((label, i) => (
            <Text
              key={i}
              variant="caption"
              color={i === todayIndex ? 'text' : 'textFaint'}
              align="center"
              style={{ width: barWidth, marginRight: i < 6 ? spacing.sm : 0 }}>
              {label}
            </Text>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <Metric label="Activities" value={String(week.runs)} size="headline" style={{ flex: 1 }} />
        <Metric
          label="Moving time"
          value={formatDuration(week.movingMs)}
          size="headline"
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}
