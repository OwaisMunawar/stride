import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/core/theme';

import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
}) {
  const { colors, radii, spacing, motion } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = options.length > 0 ? (width - 4) / options.length : 0;

  const thumb = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withSpring(index * segment, motion.spring) }],
  }));

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: 'row',
        padding: 2,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceSunken,
      }}>
      {width > 0 && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: 2,
              borderRadius: radii.md - 2,
              backgroundColor: colors.surface,
            },
            thumb,
          ]}
        />
      )}
      {options.map((option) => (
        <ScalePressable
          key={option.value}
          testID={testID ? `${testID}-${option.value}` : undefined}
          accessibilityRole="tab"
          accessibilityState={{ selected: option.value === value, disabled: option.disabled }}
          disabled={option.disabled}
          onPress={() => onChange(option.value)}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: spacing.xs + 2,
            opacity: option.disabled ? 0.4 : 1,
          }}>
          <Text variant="caption" color={option.value === value ? 'text' : 'textMuted'}>
            {option.label}
          </Text>
        </ScalePressable>
      ))}
    </View>
  );
}
