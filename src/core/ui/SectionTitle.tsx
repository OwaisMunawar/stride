import { Text } from './Text';

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="overline" color="textFaint" accessibilityRole="header" style={{ marginTop: 8 }}>
      {children}
    </Text>
  );
}
