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
import { CallProvider } from '@/context/CallContext';
import { setupNotificationListeners, removeNotificationListeners } from '@/services/pushNotifications';
import { setupCallKeep } from '@/services/callKeep';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { Home as LogoIcon } from '@/components/logo';
import Constants from 'expo-constants';

SplashScreen.preventAutoHideAsync().catch(() => {});

function stackHeaderOptions(
  title: string,
  stackBg: string,
  colorScheme: string | null | undefined,
) {
  return {
    title,
    headerShown: true as const,
    headerStyle: { backgroundColor: stackBg },
    headerTintColor: colorScheme === 'dark' ? Colors.light : Colors.beta,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
  };
}

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

    // Initialise CallKeep (CallKit on iOS / ConnectionService on Android) so
    // that incoming calls can ring the phone like a real call, even from a
    // killed app state.
    setupCallKeep().catch(() => {});

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
      <Stack.Screen
        name="reset-password"
        options={stackHeaderOptions('Reset password', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="notification-preferences"
        options={stackHeaderOptions('Notification preferences', stackBg, colorScheme)}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="posts/edit/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="stories/create"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="stories/viewer"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="stories/highlight/[id]"
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="settings/close-friends"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="call"
        options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="incoming-call"
        options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="outgoing-call"
        options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="more" options={stackHeaderOptions('More', stackBg, colorScheme)} />
      <Stack.Screen
        name="saved-posts"
        options={stackHeaderOptions('Saved posts', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="achievements"
        options={stackHeaderOptions('Achievements', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="learning-progress"
        options={stackHeaderOptions('Learning progress', stackBg, colorScheme)}
      />
      <Stack.Screen name="projects-hub" options={stackHeaderOptions('Projects', stackBg, colorScheme)} />
      <Stack.Screen
        name="admin-reports"
        options={stackHeaderOptions('Reports', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="customization"
        options={stackHeaderOptions('Customize', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="activity"
        options={stackHeaderOptions('Recent activity', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="attendance-history"
        options={{
          ...stackHeaderOptions('My Attendance', stackBg, colorScheme),
          gestureEnabled: true,
          animation: 'slide_from_right' as const,
        }}
      />
      <Stack.Screen
        name="reservation-history-studio"
        options={stackHeaderOptions('Studios history', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="reservation-history-cowork"
        options={stackHeaderOptions('Coworking history', stackBg, colorScheme)}
      />
      <Stack.Screen
        name="terms"
        options={stackHeaderOptions('Terms & conditions', stackBg, colorScheme)}
      />
      <Stack.Screen name="privacy" options={stackHeaderOptions('Privacy policy', stackBg, colorScheme)} />
      <Stack.Screen name="support" options={stackHeaderOptions('Support', stackBg, colorScheme)} />
      <Stack.Screen name="licenses" options={stackHeaderOptions('Licenses', stackBg, colorScheme)} />
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
        <CallProvider>
          <ThemeProvider value={colorScheme == 'dark' ? DarkTheme : DefaultTheme}>
            <RootLayoutNav />
            <StatusBar style={colorScheme == 'dark' ? 'light' : 'dark'} />
          </ThemeProvider>
        </CallProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
