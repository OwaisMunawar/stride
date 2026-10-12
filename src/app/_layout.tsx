// Registers the background location task. It must be imported before anything
// else so the task exists when the OS launches the app headless to deliver fixes.
import '@/composition/backgroundLocation';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createNativeServices } from '@/composition/createNativeServices';
import { ServicesProvider } from '@/composition/ServicesProvider';
import { ThemeProvider, useTheme } from '@/core/theme';
import { EmptyState, ToastProvider } from '@/core/ui';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <ServicesProvider
          create={createNativeServices}
          fallback={null}
          renderError={(error) => <StartupError message={error.message} />}>
          <Navigation />
        </ServicesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const theme = useTheme();
  const { colors } = theme;
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      primary: colors.accent,
      border: colors.border,
    },
  };

  return (
    <NavigationTheme value={navigationTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <ToastProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="run/[id]" />
          <Stack.Screen name="permissions" options={{ presentation: 'modal' }} />
        </Stack>
      </ToastProvider>
    </NavigationTheme>
  );
}

function StartupError({ message }: { message: string }) {
  const { colors } = useTheme();
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
      <EmptyState icon="close" title="Stride could not start" message={message} />
    </View>
  );
}
