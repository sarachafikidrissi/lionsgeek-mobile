import 'react-native-reanimated';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import "../index.css";

import { useColorScheme } from '@/hooks/useColorScheme';
import { AppProvider } from '@/context';
import { setupNotificationListeners, removeNotificationListeners } from '@/services/pushNotifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { Home as LogoIcon } from '@/components/logo';
import Constants from 'expo-constants';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav() {
  const notificationListenersRef = useRef(null);
  const colorScheme = useColorScheme();
  const stackBg = colorScheme === 'dark' ? Colors.dark : Colors.light;

  useEffect(() => {
    // Avoid Expo Go push-token warnings / auto-registration errors.
    // (In Expo Go, push tokens are not supported.)
    if (Constants.appOwnership === 'expo') {
      return;
    }

    // Setup notification listeners when app mounts
    setupNotificationListeners()
      .then((listeners) => {
        notificationListenersRef.current = listeners;
      })
      .catch(() => {});

    // Cleanup listeners on unmount
    return () => {
      if (notificationListenersRef.current) {
        removeNotificationListeners(notificationListenersRef.current);
      }
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: stackBg },
        gestureEnabled: true,
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true as const } : {}),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="loading" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
      <Stack.Screen name="auth/login" options={{ headerShown: false }} />
      <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="posts/edit/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? Colors.dark : Colors.light }}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <LogoIcon color={isDark ? '#fff' : '#000'} width={120} height={120} />
          <ActivityIndicator style={{ marginTop: 24 }} size="large" color={Colors.alpha} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemeProvider value={colorScheme == 'dark' ? DarkTheme : DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style={colorScheme == 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
