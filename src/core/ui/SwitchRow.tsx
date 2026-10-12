import { Switch, View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Text } from './Text';

export function SwitchRow({
  title,
  detail,
  value,
  onChange,
  testID,
}: {
  title: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="callout">{title}</Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.surfaceSunken }}
      />
    </View>
  );
}
