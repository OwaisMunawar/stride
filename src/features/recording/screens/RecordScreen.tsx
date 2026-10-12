import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServices } from '@/composition/ServicesProvider';
import { isAppError } from '@/core/errors/AppError';
import { useStore } from '@/core/hooks/useStore';
import { useTheme } from '@/core/theme';
import { Banner, Button, Pill, SegmentedControl, Text, useToast } from '@/core/ui';
import { unitLength } from '@/core/units/units';
import { RouteMap } from '@/features/tracking/components/RouteMap';
import { computeSplits } from '@/features/tracking/lib/splits';
import { type ActivityType } from '@/features/tracking/lib/types';

import { GpsBadge } from '../components/GpsBadge';
import { LiveStatsPanel } from '../components/LiveStatsPanel';
import { RecordControls } from '../components/RecordControls';
import { useRecording } from '../hooks/useRecording';
import { gpsQuality } from '../lib/gpsQuality';
import { type RecordingStatus } from '../lib/machine';
import { type LocationAccess } from '../location/permissions';

const STATUS_PILL: Record<
  RecordingStatus,
  { label: string; tone: 'danger' | 'warning' | 'neutral' }
> = {
  idle: { label: 'Ready', tone: 'neutral' },
  recording: { label: 'Recording', tone: 'danger' },
  paused: { label: 'Paused', tone: 'warning' },
  autoPaused: { label: 'Auto-paused', tone: 'warning' },
  finished: { label: 'Finished', tone: 'neutral' },
};

/** Where the map opens before the first fix: somewhere recognisable rather than the Atlantic. */
const DEFAULT_CENTER: [number, number] = [-122.4594, 37.7985];

const TAB_BAR_CLEARANCE = 40;

export function RecordScreen() {
  const services = useServices();
  const router = useRouter();
  const toast = useToast();
  const { colors, spacing, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useStore(services.settings.store);
  const { snapshot, stats, now, engine } = useRecording();
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<LocationAccess | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    let alive = true;
    void services.permissions.check().then((value) => alive && setAccess(value));
    return () => {
      alive = false;
    };
  }, [services.permissions, snapshot?.meta.id]);

  useEffect(
    () =>
      engine.finished.on((runId) => router.push({ pathname: '/run/[id]', params: { id: runId } })),
    [engine, router],
  );

  const units = settings.units;
  const points = snapshot?.points;
  const splits = useMemo(
    () => (points ? computeSplits(points, unitLength(units)).filter((s) => !s.partial) : []),
    [points, units],
  );

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      toast.show({ message: messageFor(error) });
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const current = await services.permissions.check();
      setAccess(current);
      if (current === 'none' || current === 'blocked') {
        router.push('/permissions');
        return;
      }
      await engine.start(settings.activity, 'device');
    });

  const status = snapshot?.session.status ?? null;
  const live = status === 'recording' || status === 'paused' || status === 'autoPaused';
  const lastFix = snapshot?.session.tracker.lastFix ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="record-screen">
      <RouteMap
        points={snapshot?.points ?? []}
        mode="follow"
        initialCenter={DEFAULT_CENTER}
        style={StyleSheet.absoluteFill}
        bottomInset={sheetHeight}
      />

      <View
        pointerEvents="box-none"
        style={[styles.overlay, { top: insets.top + spacing.sm, paddingHorizontal: spacing.lg }]}>
        {live && status ? (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <Pill
              testID="status-pill"
              label={STATUS_PILL[status].label}
              tone={STATUS_PILL[status].tone}
              dot
            />
          </Animated.View>
        ) : (
          <View />
        )}
        {live ? (
          <GpsBadge quality={gpsQuality(lastFix, now)} accuracyM={lastFix?.accuracy ?? null} />
        ) : null}
      </View>

      <View
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            // The native tab bar floats over the content on iOS 26.
            paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
            gap: spacing.xl,
            borderColor: colors.border,
          },
        ]}>
        {live && stats && snapshot ? (
          <LiveStatsPanel
            stats={stats}
            activity={snapshot.meta.activity}
            units={units}
            lastSplit={splits[splits.length - 1] ?? null}
          />
        ) : (
          <IdleHeader
            activity={settings.activity}
            onActivity={(value) => void services.settings.set('activity', value)}
          />
        )}

        {live && access === 'foreground' ? (
          <Banner
            testID="background-banner"
            icon="lock"
            tone="warning"
            title="Allow location Always"
            message="Recording keeps going while locked; Always makes it more reliable on long runs."
            onPress={() => router.push('/permissions')}
          />
        ) : null}

        <RecordControls
          status={status}
          busy={busy}
          onStart={start}
          onPause={() => void run(engine.pause)}
          onResume={() => void run(engine.resume)}
          onFinish={() => void run(engine.finish)}
        />

        {!live && services.isDemo ? (
          <Button
            testID="simulate-run"
            variant="ghost"
            icon="replay"
            label="Simulate a 5 km run at 10x"
            disabled={busy}
            onPress={() => void run(services.startSimulatedRun)}
          />
        ) : null}
      </View>
    </View>
  );
}

function IdleHeader({
  activity,
  onActivity,
}: {
  activity: ActivityType;
  onActivity: (value: ActivityType) => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="display">Ready when you are</Text>
        <Text color="textMuted">
          Recording keeps going with the screen locked. Your route never leaves this phone.
        </Text>
      </View>
      <SegmentedControl
        testID="activity"
        value={activity}
        onChange={onActivity}
        options={[
          { value: 'run', label: 'Run' },
          { value: 'ride', label: 'Ride' },
        ]}
      />
    </View>
  );
}

function messageFor(error: unknown): string {
  if (isAppError(error, 'LOCATION_SERVICES_OFF')) return 'Turn on Location Services to record.';
  if (isAppError(error, 'LOCATION_PERMISSION_DENIED'))
    return 'Stride needs location access to record.';
  if (isAppError(error, 'RECORDING_ALREADY_ACTIVE')) return 'A recording is already running.';
  return 'Something went wrong. Your run so far is saved.';
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
