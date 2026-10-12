/**
 * Design tokens. Components read semantic roles (`surface`, `textMuted`)
 * rather than raw palette values, so light and dark only differ here.
 */

const palette = {
  chalk: '#F5F5F2',
  chalkRaised: '#FFFFFF',
  chalkSunken: '#E9E9E4',
  asphalt: '#15171A',
  asphaltSoft: '#5B6068',
  asphaltFaint: '#8D929A',
  night: '#0D0F12',
  nightRaised: '#181B20',
  nightSunken: '#07080A',
  mist: '#F2F3F5',
  mistSoft: '#A9AEB6',
  mistFaint: '#717680',
  ember: '#FF5A1F',
  emberSoft: '#FFE3D6',
  emberDeep: '#4A1E0E',
  signal: '#E5383B',
  signalSoft: '#FBDADB',
  signalDeep: '#4B1416',
  grass: '#1FA971',
  grassSoft: '#D5F2E5',
  grassDeep: '#0F3B29',
  amber: '#D89614',
  amberSoft: '#F8EBCB',
  amberDeep: '#46330B',
} as const;

export type ColorRoles = {
  background: string;
  surface: string;
  surfaceSunken: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  record: string;
  recordSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  scrim: string;
  chartLine: string;
  chartFill: string;
  chartGrid: string;
  elevation: string;
};

const light: ColorRoles = {
  background: palette.chalk,
  surface: palette.chalkRaised,
  surfaceSunken: palette.chalkSunken,
  border: 'rgba(21, 23, 26, 0.08)',
  text: palette.asphalt,
  textMuted: palette.asphaltSoft,
  textFaint: palette.asphaltFaint,
  accent: palette.ember,
  accentSoft: palette.emberSoft,
  onAccent: '#FFFFFF',
  record: palette.signal,
  recordSoft: palette.signalSoft,
  success: palette.grass,
  successSoft: palette.grassSoft,
  warning: palette.amber,
  warningSoft: palette.amberSoft,
  danger: palette.signal,
  scrim: 'rgba(13, 15, 18, 0.45)',
  chartLine: palette.ember,
  chartFill: 'rgba(255, 90, 31, 0.16)',
  chartGrid: 'rgba(21, 23, 26, 0.07)',
  elevation: '#6B7A8F',
};

const dark: ColorRoles = {
  background: palette.night,
  surface: palette.nightRaised,
  surfaceSunken: palette.nightSunken,
  border: 'rgba(242, 243, 245, 0.08)',
  text: palette.mist,
  textMuted: palette.mistSoft,
  textFaint: palette.mistFaint,
  accent: '#FF6B33',
  accentSoft: palette.emberDeep,
  onAccent: '#FFFFFF',
  record: '#FF5357',
  recordSoft: palette.signalDeep,
  success: '#36C88C',
  successSoft: palette.grassDeep,
  warning: '#EDB341',
  warningSoft: palette.amberDeep,
  danger: '#FF5357',
  scrim: 'rgba(0, 0, 0, 0.6)',
  chartLine: '#FF6B33',
  chartFill: 'rgba(255, 107, 51, 0.2)',
  chartGrid: 'rgba(242, 243, 245, 0.07)',
  elevation: '#8C9BB0',
};

/**
 * Route colours from slowest to fastest. Chosen to stay distinguishable on both
 * map styles and for the common forms of colour blindness: blue to orange never
 * relies on red against green alone.
 */
export const paceRamp = ['#2F6BFF', '#18B5C9', '#8BD346', '#FFB020', '#FF4D2E'] as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  hero: { fontSize: 60, lineHeight: 66, fontWeight: '800', letterSpacing: -2 },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.8 },
  metric: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400', letterSpacing: 0 },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '500', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '500', letterSpacing: 0.1 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.9 },
  mono: { fontSize: 13, lineHeight: 17, fontWeight: '500', letterSpacing: 0 },
} as const;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  fast: 160,
  base: 240,
  slow: 420,
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
} as const;

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorRoles;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
};

export const themes: Record<Theme['scheme'], Theme> = {
  light: { scheme: 'light', colors: light, spacing, radii, typography, motion },
  dark: { scheme: 'dark', colors: dark, spacing, radii, typography, motion },
};
