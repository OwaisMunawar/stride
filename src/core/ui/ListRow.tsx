import { type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function ListRow({
  icon,
  title,
  detail,
  trailing,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, spacing, radii } = useTheme();
  return (
    <ScalePressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      pressedScale={0.985}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
      }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radii.sm,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={17} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="callout">{title}</Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress && <Icon name="chevronRight" size={14} color={colors.textFaint} />)}
    </ScalePressable>
  );
}
