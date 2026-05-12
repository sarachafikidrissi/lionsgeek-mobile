import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Image, Dimensions, Pressable, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import { Home as LogoIcon } from '@/components/logo';
import API from '@/api';

const { width } = Dimensions.get('window');

const slides = [
  {
    title: 'Welcome to LionsGeek',
    text: 'Manage studies, projects, and bookings seamlessly.',
    image: 'students.png',
  },
  {
    title: 'Reserve Studios',
    text: 'Students can reserve spaces and equipment with ease.',
    image: 'studio.png',
  },
  {
    title: 'Track Productivity',
    text: 'WakaTime leaderboard and detailed activity insights.',
    image: 'Winners-amico.png',
  },
  {
    title: 'Admin Controls',
    text: 'Admins manage members, projects, spaces and more.',
    image: 'Organizing projects-pana.png',
  },
];

export default function Onboarding() {
  const colorScheme = useColorScheme();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Configure notifications handler (foreground behavior)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const tokenStr = typeof token === 'string' ? token.trim() : '';

        const hasValidToken =
          !!tokenStr && tokenStr !== 'false' && tokenStr !== 'null' && tokenStr !== 'undefined';

        if (hasValidToken) {
          // Logged in users should never see onboarding.
          await AsyncStorage.setItem('onboarding_seen', '1');
          router.replace('/loading');
          return;
        }
      } catch (error) {
        console.error('[ONBOARDING] Failed to check auth token:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    redirectIfLoggedIn();
  }, []);

  const requestPermissions = async () => {
    try {
      await Notifications.requestPermissionsAsync();
      if (Platform.OS !== 'web') {
        await MediaLibrary.requestPermissionsAsync();
      }
    } catch (error) {
      console.warn('[ONBOARDING] Permission request failed:', error);
    }
  };

  const complete = async () => {
    await requestPermissions();
    await AsyncStorage.setItem('onboarding_seen', '1');
    // If logged in go to loading to verify, otherwise to login
    const token = await AsyncStorage.getItem('auth_token');
    const tokenStr = typeof token === 'string' ? token.trim() : '';
    const hasValidToken =
      !!tokenStr && tokenStr !== 'false' && tokenStr !== 'null' && tokenStr !== 'undefined';

    if (hasValidToken) router.replace('/loading');
    else router.replace('/auth/login');
  };

  const next = () => {
    if (index < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
      setIndex((i) => i + 1);
    }
  };

  if (isCheckingAuth) return null;

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <View className="flex-row items-center justify-between px-6 pt-14">
        <View className="flex-row items-center">
          <LogoIcon color={colorScheme === 'dark' ? '#fff' : '#000'} width={34} height={34} />
          <Text className="ml-2 text-xl font-semibold text-black dark:text-white">LionsGeek</Text>
        </View>
        <Pressable onPress={complete}>
          <Text className="text-sm text-yellow-500">Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {slides.map((s, i) => (
          <View key={i} style={{ width }} className="items-center px-6">
            <Image source={{ uri: `${API.APP_URL}/assets/images/banner/${s.image}` }} className="w-full h-72 mt-10" resizeMode="contain" />
            <Text className="mt-10 text-3xl font-bold text-black dark:text-white text-center">{s.title}</Text>
            <Text className="mt-3 text-base text-gray-600 dark:text-gray-300 text-center">{s.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View className="px-6 pb-10">
        <View className="flex-row justify-center mb-6">
          {slides.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full mx-1 ${i === index ? 'w-6 bg-yellow-500' : 'w-2 bg-gray-400 dark:bg-gray-600'}`}
            />
          ))}
        </View>
        {index === slides.length - 1 ? (
          <Pressable onPress={complete} className="bg-yellow-500 rounded-xl py-4">
            <Text className="text-center font-semibold text-black">Get Started</Text>
          </Pressable>
        ) : (
          <Pressable onPress={next} className="bg-black dark:bg-white rounded-xl py-4">
            <Text className="text-center font-semibold text-white dark:text-black">Continue</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}


