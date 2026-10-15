import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/toast';
import { Colors, Fonts } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';
import { AppStoreProvider, useAppStore } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

const palette = Colors.light;

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.accent,
    background: palette.background,
    card: palette.background,
    text: palette.text,
    border: palette.line,
    notification: palette.accent,
  },
};

export default function RootLayout() {
  return (
    <AppStoreProvider>
      <ThemeProvider value={navigationTheme}>
        <ToastProvider>
          <StatusBar style="dark" />
          <RootStack />
        </ToastProvider>
      </ThemeProvider>
    </AppStoreProvider>
  );
}

function RootStack() {
  const { hydrated } = useAppStore();
  const fontsReady = useAppFonts();

  useEffect(() => {
    if (hydrated && fontsReady) SplashScreen.hideAsync();
  }, [hydrated, fontsReady]);

  if (!fontsReady || !hydrated) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerTitleStyle: { fontFamily: Fonts.sansBold, fontSize: 16 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: palette.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="look/[id]" options={{ title: '' }} />
      <Stack.Screen name="choose-look" options={{ title: 'Pick a look', presentation: 'modal' }} />
      <Stack.Screen name="process" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="edit" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="strip" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="out-of-credits" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
    </Stack>
  );
}
