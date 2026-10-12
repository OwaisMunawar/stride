import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/core/theme';

export function Card({ style, padded = true, ...rest }: ViewProps & { padded?: boolean }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    />
  );
}
