import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { useServices } from '@/composition/ServicesProvider';
import { useTheme } from '@/core/theme';
import { Button, Icon, Screen, Text, type IconName } from '@/core/ui';

import { type LocationAccess } from '../location/permissions';

/**
 * Explains before the OS asks. Both platforms want "while using" first and
 * "always" as a separate, justified request; asking for background straight
 * away gets an instant denial on Android 11+ and an unexplained prompt on iOS.
 */
export function LocationRationaleScreen() {
  const { permissions } = useServices();
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [access, setAccess] = useState<LocationAccess | null>(null);

  useEffect(() => {
    void permissions.check().then(setAccess);
  }, [permissions]);

  useEffect(() => {
    if (access === 'background') router.back();
  }, [access, router]);

  const alwaysLabel = Platform.OS === 'ios' ? 'Change to Always Allow' : 'Allow all the time';

  return (
    <Screen scroll edges={['top', 'bottom']} testID="permissions-screen">
      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="location" size={30} color={colors.accent} />
        </View>
        <Text variant="display">Location, used honestly</Text>
        <Text color="textMuted">
          Stride needs your location to draw your route and measure distance. It is stored on this
          phone and nowhere else.
        </Text>
      </View>

      <Step
        icon="play"
        title="1. While using the app"
        body="Enough to record with the screen on."
        done={access === 'foreground' || access === 'background'}
      />
      <Step
        icon="lock"
        title={`2. ${Platform.OS === 'ios' ? 'Always' : 'All the time'}`}
        body={
          Platform.OS === 'ios'
            ? 'Keeps recording when you lock your phone. iOS shows a blue location indicator while it does.'
            : 'Keeps recording when you lock your phone. Android shows a "Stride is recording" notification while it does.'
        }
        done={access === 'background'}
      />

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {access === 'blocked' ? (
          <Button
            testID="open-settings"
            label="Open Settings"
            icon="settings"
            onPress={() => void permissions.openSettings()}
          />
        ) : access === 'foreground' ? (
          <Button
            testID="allow-background"
            label={alwaysLabel}
            icon="lock"
            onPress={() => void permissions.requestBackground().then(setAccess)}
          />
        ) : (
          <Button
            testID="allow-foreground"
            label="Allow while using"
            icon="location"
            onPress={() => void permissions.requestForeground().then(setAccess)}
          />
        )}
        <Button
          variant="ghost"
          label={access === 'foreground' ? 'Not now' : 'Cancel'}
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}

function Step({
  icon,
  title,
  body,
  done,
}: {
  icon: IconName;
  title: string;
  body: string;
  done: boolean;
}) {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: done ? colors.success : colors.border,
      }}>
      <Icon
        name={done ? 'check' : icon}
        size={20}
        color={done ? colors.success : colors.textMuted}
      />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="headline">{title}</Text>
        <Text variant="caption" color="textMuted">
          {body}
        </Text>
      </View>
    </View>
  );
}
