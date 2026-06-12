import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import InfoSessionHero from '@/components/infoSession/partials/InfoSessionHero';
import {
  formatSessionDate,
  getSessionStatusLabel,
  getSessionAvailabilityLabel,
} from '@/components/infoSession/helpers';

export default function InfoSessionCard({ session, onPress }) {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const statusLabel = getSessionStatusLabel(session);
  const availability = getSessionAvailabilityLabel(session);
  const isPast = statusLabel === 'Past';
  const isCompleted = availability === 'Completed';

  return (
    <Pressable
      onPress={onPress}
      className={`bg-light dark:bg-dark border border-beta/10 dark:border-light/10 rounded-2xl overflow-hidden mb-3 active:opacity-90 ${
        isPast || isCompleted ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <InfoSessionHero formation={session?.formation} height={128} />

      <View className="p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-base font-bold text-beta dark:text-light capitalize" numberOfLines={2}>
            {session?.name}
          </Text>
          {statusLabel === 'Today' ? (
            <View className="bg-good/15 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-good">Today</Text>
            </View>
          ) : statusLabel === 'Upcoming' ? (
            <View className="bg-beta/15 dark:bg-alpha/15 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-beta dark:text-alpha">Upcoming</Text>
            </View>
          ) : (
            <View className="bg-beta/10 dark:bg-light/10 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-beta/50 dark:text-light/50">Past</Text>
            </View>
          )}
        </View>

        <View className="flex-row flex-wrap gap-2 mt-2">
          <View className="bg-beta/15 dark:bg-alpha/15 px-2 py-1 rounded-full">
            <Text className="text-[10px] font-semibold text-beta dark:text-light">{session?.formation}</Text>
          </View>
          <View className="bg-beta/10 dark:bg-light/10 px-2 py-1 rounded-full">
            <Text className="text-[10px] font-semibold text-beta/60 dark:text-light/60 capitalize">
              {(session?.format || 'long') === 'long' ? 'Long' : 'Short'}
            </Text>
          </View>
          {session?.is_private ? (
            <View className="bg-beta/20 dark:bg-alpha/20 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-beta dark:text-light">Private</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center gap-2 mt-2">
          <Ionicons name="time-outline" size={14} color={accentIcon} />
          <Text className="text-xs text-beta/70 dark:text-light/70">{formatSessionDate(session)}</Text>
        </View>

        <View className="flex-row items-center gap-2 mt-1">
          <Ionicons
            name="ellipse"
            size={8}
            color={
              availability === 'Available' ? Colors.good : availability === 'Completed' ? accentIcon : Colors.error
            }
          />
          <Text className="text-xs text-beta/70 dark:text-light/70">{availability}</Text>
        </View>
      </View>
    </Pressable>
  );
}
