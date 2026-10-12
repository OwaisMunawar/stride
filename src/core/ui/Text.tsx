import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type ColorRoles, type TypographyVariant } from '@/core/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorRoles;
  align?: 'left' | 'center' | 'right';
  tabular?: boolean;
};

export function Text({
  variant = 'body',
  color = 'text',
  align,
  tabular,
  style,
  ...rest
}: TextProps) {
  const { typography, colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        align && { textAlign: align },
        variant === 'overline' && { textTransform: 'uppercase' },
        (tabular || variant === 'mono') && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    />
  );
}
