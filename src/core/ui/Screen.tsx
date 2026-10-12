import { type ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme';

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  contentStyle,
  testID,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom + spacing.lg : spacing.lg,
  };

  if (scroll) {
    return (
      <ScrollView
        testID={testID}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { paddingHorizontal: spacing.lg, gap: spacing.lg },
          padding,
          contentStyle,
        ]}>
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      testID={testID}
      style={[{ flex: 1, backgroundColor: colors.background }, padding, contentStyle]}>
      {children}
    </View>
  );
}
