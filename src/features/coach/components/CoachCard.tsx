import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useServices } from '@/composition/ServicesProvider';
import { useQuery } from '@/core/hooks/useQuery';
import { useTheme } from '@/core/theme';
import { Card, Icon, IconButton, Text } from '@/core/ui';
import { distanceUnitLabel, formatDistance, type UnitSystem } from '@/core/units/units';
import { primaryRate } from '@/features/recording/lib/liveStats';
import { type ActivityType } from '@/features/tracking/lib/types';

import { type CoachProviderId, type RunInsight, type WorkoutKind } from '../Coach';

const PROVIDER_LABEL: Record<CoachProviderId, string> = {
  rules: 'Rule-based coach',
  onDevice: 'Apple Intelligence, on device',
  server: 'Server model',
};

const KIND_LABEL: Record<WorkoutKind, string> = {
  recovery: 'Recovery',
  easy: 'Easy',
  long: 'Long',
  tempo: 'Tempo',
  intervals: 'Intervals',
};

export function CoachCard({
  runId,
  activity,
  units,
}: {
  runId: string;
  activity: ActivityType;
  units: UnitSystem;
}) {
  const { coach } = useServices();
  const { colors, spacing, radii } = useTheme();
  const read = useCallback(() => coach.insightFor(runId), [coach, runId]);
  const { data, loading, refresh } = useQuery(`insight:${runId}`, read);

  const regenerate = () => {
    void coach.regenerate(runId).then(refresh);
  };

  return (
    <Card testID="coach-card" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="sparkles" size={15} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">Coach</Text>
          {data ? (
            <Text variant="caption" color="textFaint" testID="coach-provider">
              {PROVIDER_LABEL[data.provider]}
              {data.fallbackReason ? ' (fallback)' : ''}
            </Text>
          ) : null}
        </View>
        <IconButton icon="replay" label="Regenerate insight" size={34} onPress={regenerate} />
      </View>

      {!data && loading ? (
        <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.lg }} />
      ) : data ? (
        <InsightBody insight={data} />
      ) : (
        <Text color="textMuted">The coach could not look at this run.</Text>
      )}

      {data ? (
        <View
          testID="next-run"
          style={{
            gap: spacing.xs,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceSunken,
          }}>
          <Text variant="overline" color="textFaint">
            Next session
          </Text>
          <Text variant="headline">
            {`${KIND_LABEL[data.nextRun.kind]} · ${formatDistance(
              data.nextRun.distanceKm * 1000,
              units,
              1,
            )} ${distanceUnitLabel(units)} · ${nextRate(activity, data, units)}`}
          </Text>
          <Text variant="caption" color="textMuted">
            {data.nextRun.rationale}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function InsightBody({ insight }: { insight: RunInsight }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text testID="coach-summary">{insight.summary}</Text>
      <View style={{ gap: spacing.sm }}>
        {insight.highlights.map((highlight) => (
          <View key={highlight} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: colors.accent,
                marginTop: 8,
              }}
            />
            <Text variant="callout" color="textMuted" style={{ flex: 1 }}>
              {highlight}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function nextRate(activity: ActivityType, insight: RunInsight, units: UnitSystem): string {
  const rate = primaryRate(activity, insight.nextRun.targetPaceSecPerKm, units);
  return `${rate.value} ${rate.label}`;
}
