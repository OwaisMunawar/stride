import { useTheme, type ColorRoles } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';

export function IconButton({
  icon,
  label,
  onPress,
  size = 40,
  tone = 'text',
  filled = false,
  disabled = false,
  testID,
}: {
  icon: IconName;
  /** Required: icon-only controls are invisible to VoiceOver without it. */
  label: string;
  onPress: () => void;
  size?: number;
  tone?: keyof ColorRoles;
  filled?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      pressedScale={0.9}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.surfaceSunken : 'transparent',
        opacity: disabled ? 0.4 : 1,
      }}>
      <Icon name={icon} size={size * 0.48} color={colors[tone]} />
    </ScalePressable>
  );
}
