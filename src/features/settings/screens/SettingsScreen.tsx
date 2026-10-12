import { useCallback } from 'react';
import { View } from 'react-native';

import { useServices } from '@/composition/ServicesProvider';
import { MAP_ATTRIBUTION } from '@/core/map/mapStyle';
import { useQuery } from '@/core/hooks/useQuery';
import { useStore } from '@/core/hooks/useStore';
import { isAppError } from '@/core/errors/AppError';
import { useTheme } from '@/core/theme';
import {
  Card,
  Icon,
  IconButton,
  ListRow,
  Screen,
  SectionTitle,
  SegmentedControl,
  SwitchRow,
  Text,
  useToast,
} from '@/core/ui';
import { type CoachProviderId } from '@/features/coach/Coach';
import { importGpx } from '@/features/export/useCases';

const COACH_DETAIL: Record<CoachProviderId, string> = {
  rules: 'Deterministic rules over your history. Works everywhere, offline.',
  onDevice: 'Apple Foundation Models on this iPhone. Nothing leaves the device.',
  server:
    'A language model at the endpoint configured at build time. Sends computed run stats only, never your route.',
};

export function SettingsScreen() {
  const services = useServices();
  const toast = useToast();
  const { spacing } = useTheme();
  const settings = useStore(services.settings.store);
  const readAvailability = useCallback(() => services.coach.availability(), [services.coach]);
  const { data: availability } = useQuery('coach-availability', readAvailability);

  const set = services.settings.set;

  const importFile = async () => {
    try {
      const id = await importGpx({
        runs: services.runs,
        gpx: services.gpx,
        settings: services.settings.store.get,
      });
      if (id) toast.show({ message: 'Imported. You will find it in History.' });
    } catch (error) {
      toast.show({
        message:
          isAppError(error, 'GPX_INVALID') || isAppError(error, 'GPX_EMPTY')
            ? 'That file has no track Stride can read.'
            : 'Import failed.',
      });
    }
  };

  return (
    <Screen scroll testID="settings-screen">
      <Text variant="display" style={{ marginTop: spacing.md }}>
        Settings
      </Text>

      <SectionTitle>Units</SectionTitle>
      <SegmentedControl
        testID="units"
        value={settings.units}
        onChange={(value) => void set('units', value)}
        options={[
          { value: 'metric', label: 'Kilometres' },
          { value: 'imperial', label: 'Miles' },
        ]}
      />

      <SectionTitle>Auto-pause</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <SegmentedControl
          testID="auto-pause"
          value={settings.autoPause}
          onChange={(value) => void set('autoPause', value)}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
          ]}
        />
        <Text variant="caption" color="textMuted">
          Pauses the clock when you stop at a crossing. Higher sensitivity pauses sooner. Applies
          from the next recording.
        </Text>
      </Card>

      <SectionTitle>Coach</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <SegmentedControl
          testID="coach-provider"
          value={settings.coach}
          onChange={(value) => void set('coach', value)}
          options={[
            { value: 'rules', label: 'Rules' },
            { value: 'onDevice', label: 'On device', disabled: availability?.onDevice === false },
            { value: 'server', label: 'Server', disabled: availability?.server === false },
          ]}
        />
        <Text variant="caption" color="textMuted">
          {COACH_DETAIL[settings.coach]}
          {availability?.onDevice === false && settings.coach !== 'onDevice'
            ? ' On device needs iOS 26 with Apple Intelligence.'
            : ''}
        </Text>
      </Card>

      <SectionTitle>Body</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="callout">Weight</Text>
            <Text variant="caption" color="textMuted">
              Used only for the calorie estimate.
            </Text>
          </View>
          <IconButton
            icon="minus"
            label="Decrease weight"
            filled
            size={34}
            onPress={() => void set('weightKg', Math.max(30, settings.weightKg - 1))}
          />
          <Text
            variant="headline"
            tabular
            testID="weight"
            style={{ minWidth: 56, textAlign: 'center' }}>
            {`${settings.weightKg} kg`}
          </Text>
          <IconButton
            icon="plus"
            label="Increase weight"
            filled
            size={34}
            onPress={() => void set('weightKg', Math.min(250, settings.weightKg + 1))}
          />
        </View>
        <SwitchRow
          testID="haptics"
          title="Split haptics"
          detail="A buzz at every kilometre or mile."
          value={settings.haptics}
          onChange={(value) => void set('haptics', value)}
        />
      </Card>

      <SectionTitle>Data</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <ListRow
          testID="import-gpx"
          icon="import"
          title="Import GPX"
          detail="Runs through the same filter as a recording."
          onPress={() => void importFile()}
        />
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card style={{ gap: spacing.sm }} testID="privacy">
        <PrivacyLine
          icon="lock"
          text="Routes, runs and settings are stored only on this phone, in a local SQLite database."
        />
        <PrivacyLine icon="shield" text="No account, no analytics, no crash reporting, no ads." />
        <PrivacyLine
          icon="cloud"
          text="Map tiles are downloaded from OpenFreeMap. Tile requests reveal the map area you are viewing, as with any online map."
        />
        <PrivacyLine
          icon="chip"
          text="Only with the Server coach selected: summary numbers for the run (distance, pace, splits, weekly totals) are sent to the configured endpoint. Never coordinates."
        />
      </Card>

      <Text variant="caption" color="textFaint" align="center" style={{ marginTop: spacing.lg }}>
        {`Stride 0.1.0 · Maps ${MAP_ATTRIBUTION}`}
      </Text>
    </Screen>
  );
}

function PrivacyLine({ icon, text }: { icon: 'lock' | 'shield' | 'cloud' | 'chip'; text: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
