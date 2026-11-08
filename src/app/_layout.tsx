import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Developer } from '@/components/developer';
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
    primary: palette.brand,
    background: palette.background,
    card: palette.background,
    text: palette.text,
    border: palette.line,
    notification: palette.brand,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppStoreProvider>
        <ThemeProvider value={navigationTheme}>
          <ToastProvider>
            <StatusBar style="dark" />
            <Developer />
            <RootStack />
          </ToastProvider>
        </ThemeProvider>
      </AppStoreProvider>
    </GestureHandlerRootView>
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
        headerTitleStyle: { fontFamily: Fonts.sansSemi, fontSize: 16 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: palette.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="stock/[id]" options={{ headerShown: false }} />
      {/* Full screen: the roll flow gets the whole height, with its button pinned to the bottom. */}
      <Stack.Screen name="new-roll" options={{ title: 'New roll', presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="roll/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="frame" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="order-prints" options={{ title: 'Order prints', presentation: 'modal' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="out-of-credits" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Settings' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
