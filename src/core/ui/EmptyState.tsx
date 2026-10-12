import { type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.xl,
      }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <Text variant="headline" align="center">
        {title}
      </Text>
      <Text color="textMuted" align="center">
        {message}
      </Text>
      {action}
    </View>
  );
}
