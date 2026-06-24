import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import useNotificationPreferences from '@/hooks/useNotificationPreferences';
import { NOTIFICATION_TYPE_PREF_SECTIONS } from '@/constants/notificationPreferences';

const ACCENT = '#F5C518';

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { prefs, setTypeEnabled } = useNotificationPreferences();

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  return (
    <View className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Stay connected
        </Text>
        <Text className="mt-2 text-2xl font-bold text-black dark:text-white">Notification preferences</Text>
        <Text className="mt-2 text-sm leading-5 text-gray-600 dark:text-gray-400">
          Choose which kinds of alerts appear in your inbox. Push delivery still follows your device settings; this
          filters what you see inside the app.
        </Text>

        <Pressable
          onPress={() => router.push('/(tabs)/notifications')}
          className={`mt-6 flex-row items-center justify-between rounded-2xl border px-4 py-4 ${
            isDark ? 'border-white/10 bg-white/[0.06]' : 'border-black/[0.08] bg-black/[0.02]'
          }`}
        >
          <View className="flex-row items-center gap-3 flex-1 pr-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-alpha/15">
              <Ionicons name="mail-unread-outline" size={20} color={ACCENT} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[15px] font-semibold text-black dark:text-white">View notification inbox</Text>
              <Text className="mt-0.5 text-xs text-black/50 dark:text-white/50" numberOfLines={2}>
                Full list, mark read, and open related screens
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
        </Pressable>

        <Pressable
          onPress={openSystemSettings}
          className={`mt-3 flex-row items-center justify-between rounded-2xl border px-4 py-4 ${
            isDark ? 'border-white/10 bg-white/[0.06]' : 'border-black/[0.08] bg-black/[0.02]'
          }`}
        >
          <View className="flex-row items-center gap-3 flex-1 pr-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-alpha/15">
              <Ionicons name="phone-portrait-outline" size={20} color={ACCENT} />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[15px] font-semibold text-black dark:text-white">
                {Platform.OS === 'ios' ? 'iOS notification settings' : 'System notification settings'}
              </Text>
              <Text className="mt-0.5 text-xs text-black/50 dark:text-white/50" numberOfLines={2}>
                Sounds, banners, and lock screen for LionsGeek
              </Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={18} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
        </Pressable>

        <Text className="mb-2 mt-10 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-[#a89f94]">
          In-app inbox
        </Text>
        <View
          className={`overflow-hidden rounded-3xl border ${
            isDark ? 'border-white/10 bg-[#1A1816]' : 'border-black/[0.06] bg-white'
          }`}
        >
          {NOTIFICATION_TYPE_PREF_SECTIONS.map((section, sIdx) => (
            <View key={section.title}>
              {sIdx > 0 ? <View className="mx-4 h-px bg-black/[0.06] dark:bg-white/10" /> : null}
              <Text className="px-4 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wide text-black/40 dark:text-white/40">
                {section.title}
              </Text>
              {section.items.map((item, iIdx) => {
                const on = prefs[item.type] !== false;
                const isLast =
                  sIdx === NOTIFICATION_TYPE_PREF_SECTIONS.length - 1 && iIdx === section.items.length - 1;
                return (
                  <View key={item.type}>
                    <View className="flex-row items-center px-4 py-3.5">
                      <View className="min-w-0 flex-1 pr-3">
                        <Text className="text-[15px] font-semibold text-black dark:text-white">{item.label}</Text>
                        <Text className="mt-0.5 text-xs text-black/50 dark:text-white/45" numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                      <Switch
                        value={on}
                        onValueChange={(v) => setTypeEnabled(item.type, v)}
                        trackColor={{ false: isDark ? '#3f3f46' : '#d4d4d8', true: 'rgba(245, 197, 24, 0.45)' }}
                        thumbColor={on ? ACCENT : isDark ? '#a1a1aa' : '#f4f4f5'}
                        ios_backgroundColor={isDark ? '#3f3f46' : '#d4d4d8'}
                      />
                    </View>
                    {!isLast ? <View className="ml-4 h-px bg-black/[0.06] dark:bg-white/10" /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
