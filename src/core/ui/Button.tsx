import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  testID?: string;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const { colors, radii, spacing } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.surfaceSunken, fg: colors.text },
    ghost: { bg: 'transparent', fg: colors.accent },
    danger: { bg: colors.recordSoft, fg: colors.danger },
  }[variant];
  const inactive = disabled || loading;

  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: palette.bg,
          borderRadius: radii.pill,
          paddingHorizontal: compact ? spacing.md : spacing.xl,
          minHeight: compact ? 36 : 50,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          icon && <Icon name={icon} size={compact ? 15 : 18} color={palette.fg} />
        )}
        <Text variant={compact ? 'caption' : 'headline'} style={{ color: palette.fg }}>
          {label}
        </Text>
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
