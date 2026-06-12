import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import InfoSessionAPI from '@/api/infoSessionSection';
import { getAccentFillColor, getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Skeleton from '@/components/ui/Skeleton';
import InfoSessionCard from '@/components/infoSession/partials/InfoSessionCard';
import {
  filterSessionsByName,
  normalizeInfoSessions,
  resolveInfoSessionError,
  sortSessionsByDate,
} from '@/components/infoSession/helpers';

export default function InfoSessionsTab() {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const accentFill = getAccentFillColor(isDark);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await InfoSessionAPI.getInfoSessions();
      setSessions(normalizeInfoSessions(response?.data?.infos));
    } catch (err) {
      console.error('[SCAN] Info sessions fetch error:', err);
      setError(resolveInfoSessionError(err));
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const displayedSessions = useMemo(
    () => sortSessionsByDate(filterSessionsByName(sessions, searchQuery), sortOrder),
    [sessions, searchQuery, sortOrder]
  );

  const openSession = (sessionId) => {
    router.push(`/(tabs)/infoSession/${sessionId}`);
  };

  const toggleSortOrder = () => {
    setSortOrder((order) => (order === 'desc' ? 'asc' : 'desc'));
  };

  const searchBar = (
    <View className="flex-row items-center gap-2 px-4 pt-4 pb-2">
      <View className="flex-1 flex-row items-center rounded-2xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark px-3">
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          placeholder="Search sessions…"
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
            onPress={() => fetchSessions()}
            className="mt-4 bg-beta dark:bg-alpha px-5 py-3 rounded-xl active:opacity-90"
          >
            <Text className="text-light dark:text-beta font-semibold">Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View className="flex-1">
        {searchBar}
        <View className="flex-1 items-center justify-center px-8 py-16">
          <Ionicons name="school-outline" size={48} color={accentIcon} />
          <Text className="text-base font-semibold text-beta dark:text-light mt-3">No info sessions</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">
            Info sessions from lionsgeek.ma will appear here.
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchSessions(true)} tintColor={accentFill} />
      }
    >
      {searchBar}

      <Text className="px-4 pb-2 text-xs text-beta/50 dark:text-light/50">
        {displayedSessions.length} session{displayedSessions.length === 1 ? '' : 's'}
        {sortOrder === 'desc' ? ' · newest first' : ' · oldest first'}
      </Text>

      {displayedSessions.length === 0 ? (
        <View className="items-center px-8 py-12">
          <Ionicons name="search-outline" size={40} color={accentIcon} />
          <Text className="text-base font-semibold text-beta dark:text-light mt-3">No matches</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">
            No sessions match &quot;{searchQuery}&quot;.
          </Text>
        </View>
      ) : (
        <View className="px-4">
          {displayedSessions.map((session) => (
            <InfoSessionCard key={session.id} session={session} onPress={() => openSession(session.id)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
