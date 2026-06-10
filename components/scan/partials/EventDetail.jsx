import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import EventsInfoAPI from '@/api/eventsInfoSection';
import AppLayout from '@/components/layout/AppLayout';
import AccessDenied from '@/components/scan/partials/AccessDenied';
import Skeleton from '@/components/ui/Skeleton';
import ParticipantsList from '@/components/scan/partials/ParticipantsList';
import {
  canScanEvent,
  formatEventDate,
  getEventCoverUrl,
  getEventDisplayName,
} from '@/components/scan/helpers';

export default function EventDetail() {
  const { user } = useAppContext();
  const { eventId } = useLocalSearchParams();
  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvent = useCallback(
    async (isRefresh = false) => {
      if (!eventId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await EventsInfoAPI.getEvent(eventId);
        setEvent(response?.data?.event ?? null);
        setParticipants(Array.isArray(response?.data?.participants) ? response.data.participants : []);
      } catch (err) {
        console.error('[SCAN] Event detail error:', err);
        setError('Could not load event details.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const scannable = event ? canScanEvent(event) : false;
  const title = getEventDisplayName(event?.name);
  const coverUrl = getEventCoverUrl(event?.cover);

  const openScanner = () => {
    router.push({
      pathname: '/(tabs)/scan/scanner',
      params: { eventId: String(eventId) },
    });
  };

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View className="pt-12 pb-4 px-4 border-b border-beta/10 dark:border-light/10 flex-row items-center">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2 active:opacity-70">
            <Ionicons name="arrow-back" size={24} className="text-beta dark:text-light" color="#ffc801" />
          </Pressable>
          <Text className="flex-1 text-lg font-bold text-beta dark:text-light ml-1" numberOfLines={1}>
            Event details
          </Text>
        </View>

        {loading ? (
          <View className="p-4 gap-3">
            <Skeleton width="100%" height={160} borderRadius={16} isDark={false} />
            <Skeleton width="100%" height={120} borderRadius={16} isDark={false} />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-sm text-error text-center">{error}</Text>
            <Pressable onPress={() => fetchEvent()} className="mt-4 bg-alpha px-5 py-3 rounded-xl">
              <Text className="text-beta font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchEvent(true)} tintColor="#ffc801" />
            }
          >
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} className="w-full h-44 rounded-2xl mb-4" resizeMode="cover" />
            ) : null}

            <Text className="text-xl font-bold text-beta dark:text-light">{title}</Text>
            <Text className="text-sm text-beta/70 dark:text-light/70 mt-2">{formatEventDate(event)}</Text>
            {event?.location ? (
              <View className="flex-row items-center gap-2 mt-2">
                <Ionicons name="location-outline" size={16} color="#ffc801" />
                <Text className="text-sm text-beta/70 dark:text-light/70">{event.location}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={openScanner}
              disabled={!scannable}
              className={`mt-6 flex-row items-center justify-center gap-2 py-4 rounded-2xl ${
                scannable ? 'bg-alpha active:opacity-90' : 'bg-beta/10 dark:bg-light/10'
              }`}
            >
              <Ionicons name="qr-code-outline" size={22} color={scannable ? '#212529' : '#888'} />
              <Text
                className={`text-base font-bold ${scannable ? 'text-beta' : 'text-beta/40 dark:text-light/40'}`}
              >
                {scannable ? 'Scan visitor QR' : 'Scan opens on event day'}
              </Text>
            </Pressable>

            {!scannable ? (
              <Text className="text-xs text-beta/50 dark:text-light/50 text-center mt-2">
                Scanning is available until midnight on the event date.
              </Text>
            ) : null}

            <Text className="text-base font-bold text-beta dark:text-light mt-8 mb-2">
              Registrations ({participants.length})
            </Text>
            <ParticipantsList participants={participants} />
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}
