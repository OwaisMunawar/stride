import { createContext, use, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { themes, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(themes.light);

export function ThemeProvider({
  children,
  scheme,
}: {
  children: ReactNode;
  /** Forces a scheme, used by tests and screenshots. Follows the OS otherwise. */
  scheme?: Theme['scheme'];
}) {
  const system = useColorScheme();
  const resolved = scheme ?? (system === 'dark' ? 'dark' : 'light');
  return <ThemeContext value={themes[resolved]}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  return use(ThemeContext);
}
