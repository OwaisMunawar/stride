import { View, type ViewStyle } from 'react-native';

import { useTheme, type TypographyVariant } from '@/core/theme';

import { Text } from './Text';

/**
 * A labelled number: the building block of every stats grid. Values use
 * tabular figures so a ticking clock does not make the layout shimmer.
 */
export function Metric({
  label,
  value,
  unit,
  size = 'metric',
  align = 'left',
  style,
  testID,
}: {
  label: string;
  value: string;
  unit?: string;
  size?: Extract<TypographyVariant, 'hero' | 'display' | 'metric' | 'title' | 'headline'>;
  align?: 'left' | 'center';
  style?: ViewStyle;
  testID?: string;
}) {
  const { spacing } = useTheme();
  return (
    <View
      style={[
        { gap: spacing.xxs, alignItems: align === 'center' ? 'center' : 'flex-start' },
        style,
      ]}
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}>
      <Text variant="overline" color="textFaint">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        <Text variant={size} tabular testID={testID} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {unit ? (
          <Text variant="caption" color="textMuted">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
