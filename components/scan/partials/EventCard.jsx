import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EventCoverImage from '@/components/scan/partials/EventCoverImage';
import {
  formatEventDate,
  getEventCoverUrl,
  getEventDisplayName,
  getEventStatusLabel,
} from '@/components/scan/helpers';

export default function EventCard({ event, onPress }) {
  const title = getEventDisplayName(event?.name);
  const coverUrl = getEventCoverUrl(event?.cover);
  const statusLabel = getEventStatusLabel(event);

  return (
    <Pressable
      onPress={onPress}
      className="bg-light dark:bg-dark border border-beta/10 dark:border-light/10 rounded-2xl overflow-hidden mb-3 active:opacity-90"
    >
      <EventCoverImage uri={coverUrl} height={128} />

      <View className="p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-base font-bold text-beta dark:text-light" numberOfLines={2}>
            {title}
          </Text>
          {statusLabel === 'Today' ? (
            <View className="bg-good/15 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-good">Today</Text>
            </View>
          ) : statusLabel === 'Upcoming' ? (
            <View className="bg-alpha/15 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-alpha">Upcoming</Text>
            </View>
          ) : (
            <View className="bg-beta/10 dark:bg-light/10 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-beta/50 dark:text-light/50">Past</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center gap-2 mt-2">
          <Ionicons name="time-outline" size={14} color="#ffc801" />
          <Text className="text-xs text-beta/70 dark:text-light/70">{formatEventDate(event)}</Text>
        </View>

        {event?.location ? (
          <View className="flex-row items-center gap-2 mt-1">
            <Ionicons name="location-outline" size={14} color="#ffc801" />
            <Text className="text-xs text-beta/70 dark:text-light/70 flex-1" numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
