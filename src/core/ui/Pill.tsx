import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export function Pill({
  label,
  icon,
  tone = 'neutral',
  dot = false,
  testID,
}: {
  label: string;
  icon?: IconName;
  tone?: PillTone;
  /** A leading status dot, e.g. the red "recording" light. */
  dot?: boolean;
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const palette = {
    neutral: { bg: colors.surface, fg: colors.textMuted },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.recordSoft, fg: colors.record },
  }[tone];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 1,
        borderRadius: radii.pill,
        backgroundColor: palette.bg,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      {dot && (
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.fg }} />
      )}
      {icon && <Icon name={icon} size={13} color={palette.fg} />}
      <Text variant="caption" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  );
}
