import { Pressable as RNPressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '@/core/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/**
 * Pressable with a spring press-in. The scale runs on the UI thread, so the
 * feedback stays immediate even while the JS thread is busy with a pipeline.
 */
export function ScalePressable({
  style,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { pressedScale?: number }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        scale.set(withSpring(pressedScale, motion.spring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, motion.spring));
        onPressOut?.(event);
      }}
      style={[animated, typeof style === 'function' ? undefined : style]}
    />
  );
}
