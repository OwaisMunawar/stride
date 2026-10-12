import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function Banner({
  icon,
  title,
  message,
  tone = 'accent',
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  message?: string;
  tone?: 'accent' | 'warning' | 'success';
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const toneColors = {
    accent: { bg: colors.accentSoft, fg: colors.accent },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];

  return (
    <ScalePressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      pressedScale={0.985}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: toneColors.bg,
      }}>
      <Icon name={icon} size={20} color={toneColors.fg} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="callout" style={{ color: toneColors.fg }}>
          {title}
        </Text>
        {message ? (
          <Text variant="caption" color="textMuted">
            {message}
          </Text>
        ) : null}
      </View>
      {onPress && <Icon name="chevronRight" size={14} color={toneColors.fg} />}
    </ScalePressable>
  );
}
