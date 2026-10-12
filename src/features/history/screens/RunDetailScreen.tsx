import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServices } from '@/composition/ServicesProvider';
import { useQuery } from '@/core/hooks/useQuery';
import { useStore } from '@/core/hooks/useStore';
import { paceRamp, useTheme } from '@/core/theme';
import { AreaChart } from '@/core/ui/AreaChart';
import { Button, Card, EmptyState, IconButton, Metric, Text, useToast } from '@/core/ui';
import {
  distanceUnitLabel,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  formatSpeed,
  metresToUnit,
  speedUnitLabel,
  unitLength,
} from '@/core/units/units';
import { CoachCard } from '@/features/coach/components/CoachCard';
import { exportRun } from '@/features/export/useCases';
import { primaryRate } from '@/features/recording/lib/liveStats';
import { RouteMap } from '@/features/tracking/components/RouteMap';
import { elevationProfile } from '@/features/tracking/lib/elevation';
import { paceSeries } from '@/features/tracking/lib/pace';
import { computeSplits } from '@/features/tracking/lib/splits';

import { SplitsTable } from '../components/SplitsTable';

const MAP_HEIGHT = 340;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
});

export function RunDetailScreen({ id }: { id: string }) {
  const services = useServices();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();
  const { units } = useStore(services.settings.store);

  const read = useCallback(async () => {
    const [run, points] = await Promise.all([services.runs.get(id), services.runs.points(id)]);
    return { run, points };
  }, [services.runs, id]);
  const { data, error } = useQuery(`run:${id}`, read);

  const derived = useMemo(() => {
    if (!data) return null;
    const unit = unitLength(units);
    return {
      splits: computeSplits(data.points, unit),
      pace: paceSeries(data.points).map((s) => ({
        x: metresToUnit(s.distanceM, units),
        y: data.run.activity === 'ride' ? 3600 / s.paceSecPerKm : s.paceSecPerKm,
      })),
      elevation: elevationProfile(data.points).map((s) => ({
        x: metresToUnit(s.distanceM, units),
        y: s.altitudeM,
      })),
    };
  }, [data, units]);

  // The map runs under the status bar; once it scrolls away, a backdrop fades
  // in so text never scrolls beneath the clock.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.get(),
      [MAP_HEIGHT - 120, MAP_HEIGHT - 60],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  if (error) {
    return <EmptyState icon="info" title="Run not found" message="It may have been deleted." />;
  }
  if (!data || !derived) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;
  }

  const { run, points } = data;
  const ride = run.activity === 'ride';
  const rate = primaryRate(run.activity, run.summary.avgPaceSecPerKm, units);

  const confirmDelete = () =>
    Alert.alert('Delete this activity?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void services.runs.remove(run.id).then(() => router.back()),
      },
    ]);

  const share = () =>
    void exportRun(services, run.id).catch(() =>
      toast.show({ message: 'Could not export the GPX file.' }),
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID="run-detail"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <View>
          <RouteMap
            points={points}
            mode="fit"
            colorByPace
            interactive={false}
            style={{ height: MAP_HEIGHT }}
          />
          <View
            style={{
              position: 'absolute',
              top: insets.top + spacing.xs,
              left: spacing.md,
              right: spacing.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <IconButton
              icon="close"
              label="Close"
              filled
              onPress={() => router.back()}
              testID="detail-close"
            />
            <IconButton
              icon="share"
              label="Export GPX"
              filled
              onPress={share}
              testID="export-gpx"
            />
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xxs }}>
            <Text variant="title" testID="run-title">
              {run.title}
            </Text>
            <Text variant="caption" color="textFaint">
              {dateFormat.format(run.startedAt)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" color="textFaint">
              Slower
            </Text>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
              }}>
              {paceRamp.map((color) => (
                <View key={color} style={{ flex: 1, backgroundColor: color }} />
              ))}
            </View>
            <Text variant="caption" color="textFaint">
              Faster
            </Text>
          </View>

          <Card style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row' }}>
              <Metric
                testID="detail-distance"
                label="Distance"
                value={formatDistance(run.summary.distanceM, units)}
                unit={distanceUnitLabel(units)}
                style={{ flex: 1 }}
              />
              <Metric
                label={ride ? 'Avg speed' : 'Avg pace'}
                value={rate.value}
                unit={rate.label}
                style={{ flex: 1 }}
              />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Metric
                label="Moving time"
                value={formatDuration(run.summary.movingMs)}
                size="headline"
                style={{ flex: 1 }}
              />
              <Metric
                label="Elevation"
                value={formatElevation(run.summary.elevationGainM, units)}
                size="headline"
                style={{ flex: 1 }}
              />
              <Metric
                label="Calories"
                value={String(Math.round(run.summary.calories))}
                unit="kcal"
                size="headline"
                style={{ flex: 1 }}
              />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Metric
                label="Elapsed"
                value={formatDuration(run.summary.elapsedMs)}
                size="headline"
                style={{ flex: 1 }}
              />
              <Metric
                label="Max speed"
                value={formatSpeed(run.summary.maxSpeedMps, units)}
                unit={speedUnitLabel(units)}
                size="headline"
                style={{ flex: 1 }}
              />
              <View style={{ flex: 1 }} />
            </View>
          </Card>

          <CoachCard runId={run.id} activity={run.activity} units={units} />

          {derived.pace.length > 1 ? (
            <Card style={{ gap: spacing.md }}>
              <Text variant="headline">{ride ? 'Speed' : 'Pace'}</Text>
              <AreaChart
                testID="pace-chart"
                samples={derived.pace}
                color={colors.chartLine}
                fill={colors.chartFill}
                invert={!ride}
                minSpan={ride ? 3 : 20}
                formatGuide={(value) =>
                  ride ? formatSpeed(value / 3.6, units) : formatPace(value, units)
                }
                accessibilityLabel={`${ride ? 'Speed' : 'Pace'} over distance`}
              />
            </Card>
          ) : null}

          {derived.elevation.length > 1 ? (
            <Card style={{ gap: spacing.md }}>
              <Text variant="headline">Elevation</Text>
              <AreaChart
                testID="elevation-chart"
                samples={derived.elevation}
                color={colors.elevation}
                fill={`${colors.elevation}40`}
                minSpan={10}
                height={110}
                formatGuide={(value) => formatElevation(value, units)}
                accessibilityLabel="Elevation over distance"
              />
            </Card>
          ) : null}

          {derived.splits.length > 0 ? (
            <Card style={{ gap: spacing.md }}>
              <Text variant="headline">Splits</Text>
              <SplitsTable splits={derived.splits} units={units} />
            </Card>
          ) : null}

          <Button
            variant="danger"
            icon="trash"
            label="Delete activity"
            onPress={confirmDelete}
            testID="delete-run"
          />
        </View>
      </Animated.ScrollView>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: colors.background,
          },
          backdrop,
        ]}
      />
    </View>
  );
}
