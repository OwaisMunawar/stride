import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { type ColorValue } from 'react-native';

/**
 * Semantic icon names. Screens ask for "trash", not for an SF Symbol or a
 * Material glyph, so each platform gets its native icon from one table.
 */
const glyphs = {
  run: { ios: 'figure.run', android: 'directions_run' },
  ride: { ios: 'bicycle', android: 'directions_bike' },
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  stop: { ios: 'stop.fill', android: 'stop' },
  flag: { ios: 'flag.checkered', android: 'sports_score' },
  location: { ios: 'location.fill', android: 'my_location' },
  locationSlash: { ios: 'location.slash', android: 'location_disabled' },
  clock: { ios: 'clock', android: 'schedule' },
  flame: { ios: 'flame.fill', android: 'local_fire_department' },
  mountain: { ios: 'mountain.2.fill', android: 'landscape' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  trash: { ios: 'trash', android: 'delete' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
  import: { ios: 'square.and.arrow.down', android: 'file_download' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  check: { ios: 'checkmark', android: 'check' },
  close: { ios: 'xmark', android: 'close' },
  lock: { ios: 'lock.fill', android: 'lock' },
  shield: { ios: 'checkmark.shield', android: 'shield' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  history: { ios: 'chart.bar.fill', android: 'bar_chart' },
  chip: { ios: 'cpu', android: 'memory' },
  cloud: { ios: 'cloud', android: 'cloud' },
  minus: { ios: 'minus', android: 'remove' },
  plus: { ios: 'plus', android: 'add' },
  replay: { ios: 'arrow.triangle.2.circlepath', android: 'replay' },
  info: { ios: 'info.circle', android: 'info' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof glyphs;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
}) {
  return (
    <SymbolView
      name={glyphs[name]}
      size={size}
      tintColor={color}
      weight="semibold"
      style={{ width: size, height: size }}
    />
  );
}
