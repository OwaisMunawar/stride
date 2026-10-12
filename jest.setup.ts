/* eslint-disable @typescript-eslint/no-require-imports */
// Component tests render real screens over an in-memory SQLite database and a
// fake location source. Only native views and device APIs are replaced here.
import 'react-native-gesture-handler/jestSetup';
import 'react-native-reanimated/mock';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

jest.mock('@shopify/react-native-skia', () => {
  const { View } = require('react-native');
  const builder = () => {
    const self = {
      moveTo: () => self,
      lineTo: () => self,
      close: () => self,
      addRRect: () => self,
      detach: () => ({}),
      build: () => ({}),
    };
    return self;
  };
  const Noop = () => null;
  return {
    Canvas: View,
    Path: Noop,
    RoundedRect: Noop,
    LinearGradient: Noop,
    vec: (x: number, y: number) => ({ x, y }),
    Skia: { PathBuilder: { Make: builder } },
  };
});

// The map is a native view; tests assert on what Stride passes to it.
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  const Passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Map: ({ children, testID }: { children?: unknown; testID?: string }) =>
      require('react').createElement(View, { testID: testID ?? 'map' }, children),
    Camera: () => null,
    GeoJSONSource: Passthrough,
    Layer: () => null,
  };
});

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  return {
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
    __router: router,
  };
});

// Legend List virtualises from measured layout, which Jest never produces.
// A FlatList stand-in renders every row so screens can be asserted on.
jest.mock('@legendapp/list/react-native', () => {
  const { FlatList } = require('react-native');
  return { LegendList: FlatList };
});
