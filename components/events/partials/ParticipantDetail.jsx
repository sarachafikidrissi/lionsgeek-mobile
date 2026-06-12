import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import EventsInfoAPI from '@/api/eventsInfoSection';
import AppLayout from '@/components/layout/AppLayout';
import AccessDenied from '@/components/events/partials/AccessDenied';
import Skeleton from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  fetchParticipantOtherRegistrations,
  findParticipantById,
  formatEventDate,
  getEventDisplayName,
  getEventStatusLabel,
  getParticipantDetailRows,
  isSameEventId,
} from '@/components/events/helpers';

function SectionCard({ children, className = '' }) {
  return (
    <View
      className={`bg-light dark:bg-dark_gray border border-beta/8 dark:border-light/8 rounded-2xl overflow-hidden ${className}`}
    >
      {children}
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View className="flex-row items-start gap-3 py-3 border-b border-beta/6 dark:border-light/6 last:border-b-0">
      <View className="w-9 h-9 rounded-xl bg-alpha/12 items-center justify-center mt-0.5">
        <Ionicons name={icon} size={16} color={Colors.alpha} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">
          {label}
        </Text>
        <Text className="text-sm font-medium text-beta dark:text-light mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

function OtherEventRow({ item, isDark, onPress }) {
  const title = getEventDisplayName(item.event?.name);
  const status = getEventStatusLabel(item.event);
  const scanned = Boolean(item.registration?.is_visited);

  return (
    <Pressable
      onPress={onPress}
      className="py-3 border-b border-beta/6 dark:border-light/6 last:border-b-0 active:opacity-80"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-semibold text-beta dark:text-light" numberOfLines={2}>
            {title}
          </Text>
          <Text className="text-xs text-beta/55 dark:text-light/55 mt-1">
            {formatEventDate(item.event)}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          {status === 'Today' ? (
            <View className="bg-good/15 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-good">{status}</Text>
            </View>
          ) : status === 'Upcoming' ? (
            <View className="bg-alpha/15 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-alpha">{status}</Text>
            </View>
          ) : (
            <View className="bg-beta/10 dark:bg-light/10 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-bold text-beta/55 dark:text-light/55">{status}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color={Colors.alpha} />
        </View>
      </View>
      <View className="flex-row items-center gap-2 mt-2">
        {scanned ? (
          <View className="flex-row items-center gap-1 bg-good/15 px-2 py-1 rounded-full">
            <Ionicons name="qr-code" size={11} color={Colors.good} />
            <Text className="text-[10px] font-semibold text-good">Checked in</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1 bg-beta/10 dark:bg-light/10 px-2 py-1 rounded-full">
            <Ionicons name="time-outline" size={11} color={isDark ? Colors.light : Colors.beta} />
            <Text className="text-[10px] font-semibold text-beta/50 dark:text-light/50">Not checked in</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function ParticipantDetail() {
  const { user } = useAppContext();
  const params = useLocalSearchParams();
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const participantId = Array.isArray(params.id) ? params.id[0] : params.id;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [participant, setParticipant] = useState(null);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [otherRegistrations, setOtherRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOther, setLoadingOther] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const detailRows = useMemo(() => getParticipantDetailRows(participant), [participant]);

  const otherEventsOnly = useMemo(
    () => otherRegistrations.filter((item) => !isSameEventId(item.event?.id, eventId)),
    [otherRegistrations, eventId]
  );

  const openOtherEvent = (otherEventId) => {
    router.push(`/(tabs)/events/${otherEventId}`);
  };

  const loadParticipant = useCallback(
    async (isRefresh = false) => {
      if (!eventId || !participantId) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setOtherRegistrations([]);

      try {
        const response = await EventsInfoAPI.getEvent(eventId);
        const event = response?.data?.event ?? null;
        const participants = Array.isArray(response?.data?.participants) ? response.data.participants : [];
        const match = findParticipantById(participants, participantId);

        if (!match) {
          setError('Participant not found for this event.');
          setParticipant(null);
          setCurrentEvent(null);
          return;
        }

        setCurrentEvent(event);
        setParticipant(match);

        if (match.email) {
          setLoadingOther(true);
          try {
            const others = await fetchParticipantOtherRegistrations(match.email, eventId);
            setOtherRegistrations(others);
          } catch (otherErr) {
            console.error('[SCAN] Other registrations error:', otherErr);
            setOtherRegistrations([]);
          } finally {
            setLoadingOther(false);
          }
        }
      } catch (err) {
        console.error('[SCAN] Participant detail error:', err);
        setError('Could not load participant details.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, participantId]
  );

  useEffect(() => {
    loadParticipant();
  }, [loadParticipant]);

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  const eventTitle = getEventDisplayName(currentEvent?.name);
  const initial = (participant?.name || '?').charAt(0).toUpperCase();

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View className="pt-12 pb-3 px-4 flex-row items-center gap-2 border-b border-beta/8 dark:border-light/8">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-alpha/15 items-center justify-center active:opacity-70"
          >
            <Ionicons name="arrow-back" size={20} color={Colors.alpha} />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
              Visitor
            </Text>
            {loading ? (
              <Skeleton width={140} height={16} borderRadius={6} isDark={isDark} />
            ) : (
              <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={1}>
                {participant?.name || 'Participant'}
              </Text>
            )}
          </View>
        </View>

        {loading ? (
          <View className="p-4 gap-4">
            <Skeleton width="100%" height={120} borderRadius={20} isDark={isDark} />
            <Skeleton width="100%" height={160} borderRadius={16} isDark={isDark} />
            <Skeleton width="100%" height={200} borderRadius={16} isDark={isDark} />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
            <Text className="text-base font-semibold text-beta dark:text-light text-center mt-3">{error}</Text>
            <Pressable
              onPress={() => loadParticipant()}
              className="mt-6 flex-row items-center gap-2 bg-alpha px-6 py-3.5 rounded-2xl active:opacity-90"
            >
              <Ionicons name="refresh" size={18} color={Colors.beta} />
              <Text className="text-beta font-bold">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 pb-10 gap-4"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadParticipant(true)}
                tintColor={Colors.alpha}
                colors={[Colors.alpha]}
              />
            }
          >
            <SectionCard className="p-4 items-center">
              <View className="w-20 h-20 rounded-full bg-alpha/15 items-center justify-center mb-3">
                <Text className="text-3xl font-bold text-alpha">{initial}</Text>
              </View>
              <Text className="text-xl font-bold text-beta dark:text-light text-center">{participant?.name}</Text>
              <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">{participant?.email}</Text>

              <View className="flex-row flex-wrap items-center justify-center gap-2 mt-4">
                {participant?.is_visited ? (
                  <View className="flex-row items-center gap-1.5 bg-good/15 px-3 py-1.5 rounded-full">
                    <Ionicons name="qr-code" size={14} color={Colors.good} />
                    <Text className="text-xs font-bold text-good">Checked in</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1.5 bg-beta/10 dark:bg-light/10 px-3 py-1.5 rounded-full">
                    <Ionicons name="hourglass-outline" size={14} color={isDark ? Colors.light : Colors.beta} />
                    <Text className="text-xs font-bold text-beta/55 dark:text-light/55">Not checked in yet</Text>
                  </View>
                )}
              </View>

              {eventTitle ? (
                <Text className="text-xs text-beta/45 dark:text-light/45 text-center mt-3">
                  Registered for {eventTitle}
                </Text>
              ) : null}
            </SectionCard>

            <SectionCard className="px-4">
              <Text className="text-sm font-bold text-beta dark:text-light pt-4 pb-1">Details</Text>
              <DetailRow icon="mail-outline" label="Email" value={participant?.email || '—'} />
              {detailRows.map((row) => (
                <DetailRow
                  key={`${row.label}-${row.value}`}
                  icon="information-circle-outline"
                  label={row.label}
                  value={row.value}
                />
              ))}
              {!detailRows.length ? (
                <Text className="text-xs text-beta/45 dark:text-light/45 py-3">
                  No additional profile fields from the registration.
                </Text>
              ) : null}
            </SectionCard>

            <SectionCard className="p-4">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-lg bg-alpha/15 items-center justify-center">
                    <Ionicons name="calendar-outline" size={16} color={Colors.alpha} />
                  </View>
                  <Text className="text-base font-bold text-beta dark:text-light">Other events</Text>
                </View>
                {!loadingOther ? (
                  <View className="bg-alpha/15 px-2.5 py-1 rounded-full">
                    <Text className="text-xs font-bold text-beta dark:text-light">{otherEventsOnly.length}</Text>
                  </View>
                ) : null}
              </View>

              <Text className="text-xs text-beta/50 dark:text-light/50 mb-3 leading-5">
                Other lionsgeek.ma events this visitor is registered for (matched by email).
              </Text>

              {loadingOther ? (
                <View className="gap-3 py-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <Skeleton key={index} width="100%" height={72} borderRadius={12} isDark={isDark} />
                  ))}
                </View>
              ) : otherEventsOnly.length === 0 ? (
                <View className="items-center py-6">
                  <Ionicons name="calendar-outline" size={32} color={Colors.alpha} />
                  <Text className="text-sm font-semibold text-beta dark:text-light mt-3">No other events</Text>
                  <Text className="text-xs text-beta/50 dark:text-light/50 text-center mt-1 px-4">
                    This visitor is only registered for the current event.
                  </Text>
                </View>
              ) : (
                <View>
                  {otherEventsOnly.map((item) => (
                    <OtherEventRow
                      key={String(item.event?.id)}
                      item={item}
                      isDark={isDark}
                      onPress={() => openOtherEvent(item.event?.id)}
                    />
                  ))}
                </View>
              )}
            </SectionCard>
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}
