import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EventsInfoAPI from '@/api/eventsInfoSection';
import Skeleton from '@/components/ui/Skeleton';
import EventCard from '@/components/scan/partials/EventCard';
import { filterActiveEvents, groupEventsByDay, resolveEventsError } from '@/components/scan/helpers';

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await EventsInfoAPI.getEvents();
      const list = filterActiveEvents(response?.data);
      setEvents(list);
    } catch (err) {
      console.error('[SCAN] Events fetch error:', err);
      setError(resolveEventsError(err));
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const { live, upcoming } = groupEventsByDay(events);

  const openEvent = (eventId) => {
    router.push(`/(tabs)/scan/${eventId}`);
  };

  if (loading) {
    return (
      <View className="px-4 pt-4 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={180} borderRadius={16} isDark={false} />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="cloud-offline-outline" size={48} color="#ef4444" />
        <Text className="text-sm text-error text-center mt-3">{error}</Text>
        <Pressable
          onPress={() => fetchEvents()}
          className="mt-4 bg-alpha px-5 py-3 rounded-xl active:opacity-90"
        >
          <Text className="text-beta font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8 py-16">
        <Ionicons name="calendar-outline" size={48} color="#ffc801" />
        <Text className="text-base font-semibold text-beta dark:text-light mt-3">No active events</Text>
        <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">
          Events for today and upcoming dates will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchEvents(true)} tintColor="#ffc801" />}
    >
      {live.length > 0 ? (
        <View className="mb-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-alpha mb-2">Today</Text>
          {live.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => openEvent(event.id)} />
          ))}
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View>
          <Text className="text-xs font-bold uppercase tracking-wider text-beta/50 dark:text-light/50 mb-2">
            Upcoming
          </Text>
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} onPress={() => openEvent(event.id)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
