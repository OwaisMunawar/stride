import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

/**
 * The big circular transport controls. Large on purpose: they get pressed
 * mid-stride, with sweaty thumbs, sometimes in gloves.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  onLongPress,
  tone = 'accent',
  size = 84,
  hint,
  disabled = false,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: 'accent' | 'neutral' | 'danger';
  size?: number;
  /** Shown under the label, e.g. "Hold to finish". */
  hint?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  const palette = {
    accent: { bg: colors.accent, fg: colors.onAccent },
    neutral: { bg: colors.surfaceSunken, fg: colors.text },
    danger: { bg: colors.record, fg: colors.onAccent },
  }[tone];
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <ScalePressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={600}
        pressedScale={0.92}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          boxShadow: tone === 'neutral' ? undefined : `0 8px 24px ${palette.bg}55`,
        }}>
        <Icon name={icon} size={size * 0.36} color={palette.fg} />
      </ScalePressable>
      <View style={{ alignItems: 'center' }}>
        <Text variant="callout">{label}</Text>
        {hint ? (
          <Text variant="caption" color="textFaint">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
