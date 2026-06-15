import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import EventsInfoAPI from '@/api/eventsInfoSection';
import { getAccentFillColor, getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Skeleton from '@/components/ui/Skeleton';
import EventCard from '@/components/events/partials/EventCard';
import {
  filterEventsByName,
  filterEventsForViewer,
  normalizeEvents,
  resolveEventsError,
  sortEventsByDate,
} from '@/components/events/helpers';

export default function EventsTab() {
  const { user } = useAppContext();
  const canAccessScan = userCanAccessScan(user);
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const accentFill = getAccentFillColor(isDark);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await EventsInfoAPI.getEvents();
      setEvents(normalizeEvents(response?.data));
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

  const viewerEvents = useMemo(
    () => filterEventsForViewer(events, user),
    [events, user]
  );

  const displayedEvents = useMemo(
    () => sortEventsByDate(filterEventsByName(viewerEvents, searchQuery), sortOrder),
    [viewerEvents, searchQuery, sortOrder]
  );

  const openEvent = (eventId) => {
    router.push(`/(tabs)/events/${eventId}`);
  };

  const toggleSortOrder = () => {
    setSortOrder((order) => (order === 'desc' ? 'asc' : 'desc'));
  };

  const searchBar = (
    <View className="flex-row items-center gap-2 px-4 pt-4 pb-2">
      <View className="flex-1 flex-row items-center rounded-2xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark px-3">
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          placeholder="Search events…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          className="flex-1 min-h-11 py-2 pl-2 text-sm text-beta dark:text-light"
          placeholderTextColor="#888"
          autoCorrect={false}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8} className="p-1">
            <Ionicons name="close-circle" size={18} color="#888" />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={toggleSortOrder}
        accessibilityLabel={sortOrder === 'desc' ? 'Sort oldest to newest' : 'Sort newest to oldest'}
        className="w-11 h-11 rounded-2xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark items-center justify-center active:opacity-80"
      >
        <Ionicons
          name={sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'}
          size={20}
          color={accentFill}
        />
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1">
        {searchBar}
        <View className="px-4 pt-2 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={180} borderRadius={16} isDark={false} />
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1">
        {searchBar}
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={48} color="#ef4444" />
          <Text className="text-sm text-error text-center mt-3">{error}</Text>
          <Pressable
            onPress={() => fetchEvents()}
            className="mt-4 bg-beta dark:bg-alpha px-5 py-3 rounded-xl active:opacity-90"
          >
            <Text className="text-light dark:text-beta font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (viewerEvents.length === 0) {
    return (
      <View className="flex-1">
        {searchBar}
        <View className="flex-1 items-center justify-center px-8 py-16">
          <Ionicons name="calendar-outline" size={48} color={accentIcon} />
          <Text className="text-base font-semibold text-beta dark:text-light mt-3">No events</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">
            Events from lionsgeek.ma will appear here.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchEvents(true)} tintColor={accentFill} />}
    >
      {searchBar}

      <Text className="px-4 pb-2 text-xs text-beta/50 dark:text-light/50">
        {displayedEvents.length} event{displayedEvents.length === 1 ? '' : 's'}
        {sortOrder === 'desc' ? ' · newest first' : ' · oldest first'}
      </Text>

      {displayedEvents.length === 0 ? (
        <View className="items-center px-8 py-12">
          <Ionicons name="search-outline" size={40} color={accentIcon} />
          <Text className="text-base font-semibold text-beta dark:text-light mt-3">No matches</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">
            No events match &quot;{searchQuery}&quot;.
          </Text>
        </View>
      ) : (
        <View className="px-4">
          {displayedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => openEvent(event.id)}
              treatPastByDateTime={!canAccessScan}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
