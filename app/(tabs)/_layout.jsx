import { Tabs, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { token } = useAppContext();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [storedToken, setStoredToken] = useState(null);

  // Check if token exists in storage (in case context hasn't loaded yet)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const nextStoredToken = await AsyncStorage.getItem('auth_token');
        setStoredToken(nextStoredToken);

        if (!nextStoredToken && !token) {
          // No token in storage and no token in context - redirect to login
          router.replace('/auth/login');
        }
      } catch (error) {
        console.error('[TABS] Error checking auth:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [token]);

  useEffect(() => {
    // Only redirect if we've finished checking and there's no token
    if (!isCheckingAuth && !token && !storedToken) {
      router.replace('/auth/login');
    }
  }, [token, storedToken, isCheckingAuth]);


  const { user } = useAppContext();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some(r => ['admin', 'coach'].includes(r?.toLowerCase?.() || r));

  // Map SF Symbols icon names to Ionicons names for cross-platform support
  const getIconName = (sfSymbolName, focused = false) => {
    const iconMap = {
      "house.fill": focused ? "home" : "home-outline",
      "calendar": focused ? "calendar" : "calendar-outline",
      "chatbubbles.fill": focused ? "chatbubbles" : "chatbubbles-outline",
      "trophy.fill": focused ? "trophy" : "trophy-outline",
      "ellipsis": "ellipsis-horizontal",
      "person.3.fill": focused ? "people" : "people-outline",
      "hammer.fill": focused ? "hammer" : "hammer-outline",
      "person.fill": focused ? "person" : "person-outline",
      "magnifyingglass": focused ? "search" : "search-outline",
      "bell.fill": focused ? "notifications" : "notifications-outline",
    };
    return iconMap[sfSymbolName] || sfSymbolName;
  };

  const tabScreen = [
    { route: "index", name: "Home", icon: "house.fill", showTab: true, roles: [] }, // Everyone
    { route: "reservations", name: "Reservations", icon: "calendar", showTab: true, roles: [] }, // Everyone
    { route: "training", name: "Training", icon: "school", showTab: true, roles: [] }, // Everyone
    { route: "leaderboard", name: "Leaderboard", icon: "trophy.fill", showTab: true, roles: [] },
    { route: "profile", name: "Profile", icon: "person.fill", showTab: true, roles: [] }, // Everyone
  ].filter(screen => screen.showTab)

  const hiddenScreens = [
    // hado mo2a9atan hna
    { route: "members", name: "Members", icon: "person.3.fill", showTab: isAdmin, roles: ['admin', 'coach'] },
    { route: "projects", name: "Projects", icon: "hammer.fill", showTab: true, roles: [] }, // 
    // tal 7ad  hna
    { route: "home", name: "Home", icon: "house.fill", showTab: false }, // Hide duplicate home tab
    { route: "search", name: "Search", icon: "magnifyingglass", showTab: false },
    { route: "notifications", name: "Notifications", icon: "bell.fill", showTab: false },
  ]


  const isDark = colorScheme === 'dark';
  const activeRingColor = Colors.alpha;

  const resolveProfileAvatarValue = () => user?.avatar || user?.image;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.alpha,
        tabBarInactiveTintColor: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: isDark ? Colors.dark : Colors.light,
            borderTopColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
            borderTopWidth: 1,
          },
          default: {
            backgroundColor: isDark ? Colors.dark : Colors.light,
            borderTopColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
            borderTopWidth: 1,
          },
        }),
      }}>


      {/* screen inside the navigation bar */}
      {tabScreen.map((screen, idx) => (
        <Tabs.Screen
          key={idx}
          name={screen.route}
          options={{
            headerShown: false,
            title: screen.name,
            ...(screen.route === 'profile'
              ? {
                  // Tabs keep screens mounted; if we previously opened someone via
                  // `/(tabs)/profile?userId=...`, tapping the Profile tab must reset
                  // back to your own profile (no params).
                  tabBarButton: (props) => (
                    <HapticTab
                      {...props}
                      onPress={() => {
                        router.replace('/(tabs)/profile');
                      }}
                    />
                  ),
                }
              : {}),
            tabBarIcon: ({ color, focused }) => {
              if (screen.route === 'profile') {
                const avatarUrl = API.APP_URL + "/storage/img/profile/" + user?.image;
                const ringClassName = focused ? 'border-2' : 'border';
                const ringStyle = { borderColor: focused ? activeRingColor : 'transparent' };
                // console.log(avatarUrl);
                
                return (
                  <View className={`w-8 h-8 rounded-full overflow-hidden ${ringClassName}`} style={ringStyle}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-alpha/20">
                        <Ionicons size={18} name={focused ? 'person' : 'person-outline'} color={color} />
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <Ionicons
                  size={28}
                  name={getIconName(screen.icon, focused)}
                  color={color}
                />
              );
            },
            tabBarStyle: screen.showTab ? undefined : { display: 'none' },
          }}
        />
      ))}



      {/* screen hidden from nav tab */}
      {hiddenScreens.map((screen, idx) => (
        <Tabs.Screen
          key={idx}
          name={screen.route}
          options={{
            headerShown: false,
            title: screen.name,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                size={28}
                name={getIconName(screen.icon, focused)}
                color={color}
              />
            ),
            tabBarStyle: screen.showTab ? undefined : { display: 'none' },
            href: null,
          }}
        />
      ))}

    </Tabs>
  );
}
