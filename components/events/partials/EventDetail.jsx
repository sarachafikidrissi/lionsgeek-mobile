import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import EventsInfoAPI from '@/api/eventsInfoSection';
import AppLayout from '@/components/layout/AppLayout';
import AccessDenied from '@/components/events/partials/AccessDenied';
import Skeleton from '@/components/ui/Skeleton';
import ParticipantsList from '@/components/events/partials/ParticipantsList';
import EventCoverImage from '@/components/events/partials/EventCoverImage';
import { Colors, getAccentFillColor, getAccentIconColor, getOnAccentTextColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  canScanEvent,
  formatEventCapacity,
  getEventCoverUrl,
  getEventDisplayName,
  getEventStatusLabel,
  getEventTotalCapacity,
  getParticipantCounts,
} from '@/components/events/helpers';

function StatusBadge({ status }) {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);

  if (status === 'Today') {
    return (
      <View className="flex-row items-center gap-1.5 bg-good/20 px-3 py-1.5 rounded-full">
        <View className="w-1.5 h-1.5 rounded-full bg-good" />
        <Text className="text-xs font-bold text-good">Today</Text>
      </View>
    );
  }
  if (status === 'Upcoming') {
    return (
      <View className="flex-row items-center gap-1.5 bg-beta/20 dark:bg-alpha/20 px-3 py-1.5 rounded-full">
        <Ionicons name="time-outline" size={12} color={accentIcon} />
        <Text className="text-xs font-bold text-beta dark:text-alpha">Upcoming</Text>
      </View>
    );
  }
  return (
    <View className="bg-beta/15 dark:bg-light/15 px-3 py-1.5 rounded-full">
      <Text className="text-xs font-bold text-beta/60 dark:text-light/60">Past</Text>
    </View>
  );
}


function SectionCard({ children, className = '' }) {
  return (
    <View
      className={`bg-light dark:bg-dark_gray border border-beta/8 dark:border-light/8 rounded-2xl overflow-hidden ${className}`}
    >
      {children}
    </View>
  );
}

function AttendanceStat({ icon, label, value, tone = 'alpha' }) {
  const isDark = useColorScheme() === 'dark';
  const toneClasses =
    tone === 'good'
      ? {
          box: 'bg-good/12 border-good/20',
          icon: Colors.good,
          value: 'text-good',
          label: 'text-good',
        }
      : {
          box: 'bg-beta/12 dark:bg-alpha/12 border-beta/20 dark:border-alpha/20',
          icon: getAccentIconColor(isDark),
          value: 'text-beta dark:text-light',
          label: 'text-beta/55 dark:text-light/55',
        };

  return (
    <View className={`flex-1 border rounded-xl p-3.5 ${toneClasses.box}`}>
      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name={icon} size={16} color={toneClasses.icon} />
        <Text className={`text-[10px] font-bold uppercase tracking-wide ${toneClasses.label}`}>{label}</Text>
      </View>
      <Text className={`text-2xl font-bold ${toneClasses.value}`}>{value}</Text>
    </View>
  );
}

function DetailSkeleton({ isDark }) {
  return (
    <View className="p-4 gap-4">
      <Skeleton width="100%" height={200} borderRadius={20} isDark={isDark} />
      <Skeleton width="100%" height={140} borderRadius={16} isDark={isDark} />
      <Skeleton width="100%" height={56} borderRadius={16} isDark={isDark} />
      <Skeleton width="100%" height={180} borderRadius={16} isDark={isDark} />
    </View>
  );
}

export default function EventDetail() {
  const { user } = useAppContext();
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const accentFill = getAccentFillColor(isDark);
  const onAccentText = getOnAccentTextColor(isDark);

  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const skipFocusRefresh = useRef(true);
  const scrollViewRef = useRef(null);

  // Scroll to bottom when the participant search input is focused so the
  // keyboard never covers it — more reliable than KeyboardAvoidingView alone.
  const handleSearchFocus = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 320);
  }, []);

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [participants, participantSearch]);

  const fetchEvent = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await EventsInfoAPI.getEvent(id);
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
    [id]
  );

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefresh.current) {
        skipFocusRefresh.current = false;
        return;
      }
      fetchEvent(true);
    }, [fetchEvent])
  );

  const scannable = event ? canScanEvent(event) : false;
  const title = getEventDisplayName(event?.name);
  const coverUrl = getEventCoverUrl(event?.cover);
  const statusLabel = event ? getEventStatusLabel(event) : null;
  const capacityLabel = event ? formatEventCapacity(event, participants.length) : null;
  const totalCapacity = event ? getEventTotalCapacity(event, participants.length) : null;
  const capacityFill =
    totalCapacity && totalCapacity > 0 ? Math.min(1, participants.length / totalCapacity) : 0;
  const { registered: registeredCount, scanned: scannedCount } = getParticipantCounts(participants);

  const openScanner = () => {
    router.push({
      pathname: '/(tabs)/events/scanner',
      params: { id: String(id) },
    });
  };

  const openParticipant = (participant) => {
    router.push({
      pathname: '/(tabs)/events/participant/[id]',
      params: {
        id: String(participant.id),
        eventId: String(id),
      },
    });
  };

  if (!userCanAccessScan(user)) {
    return <AccessDenied />;
  }

  return (
    <AppLayout showNavbar={false}>
      <KeyboardAvoidingView
        className="flex-1 bg-light dark:bg-dark"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View className="pt-12 pb-3 px-4 flex-row items-center gap-2 border-b border-beta/8 dark:border-light/8">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-beta/15 dark:bg-alpha/15 items-center justify-center active:opacity-70"
          >
            <Ionicons name="arrow-back" size={20} color={accentIcon} />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
              Scan
            </Text>
            {loading ? (
              <Skeleton width={160} height={16} borderRadius={6} isDark={isDark} />
            ) : (
              <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={1}>
                {title}
              </Text>
            )}
          </View>
          {!loading && !error && (
            <Pressable
              onPress={scannable ? openScanner : undefined}
              disabled={!scannable}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl ${
                scannable ? 'bg-beta dark:bg-alpha active:opacity-80' : 'bg-beta/10 dark:bg-light/10'
              }`}
            >
              <Ionicons
                name="qr-code"
                size={17}
                color={scannable ? onAccentText : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
              />
              <Text
                className={`text-xs font-bold ${
                  scannable ? 'text-light dark:text-beta' : 'text-beta/35 dark:text-light/35'
                }`}
              >
                {scannable ? 'Scan' : 'Not today'}
              </Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <DetailSkeleton isDark={isDark} />
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <View className="w-16 h-16 rounded-2xl bg-error/15 items-center justify-center mb-4">
              <Ionicons name="cloud-offline-outline" size={32} color={Colors.error} />
            </View>
            <Text className="text-base font-semibold text-beta dark:text-light text-center">
              Something went wrong
            </Text>
            <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-2">{error}</Text>
            <Pressable
              onPress={() => fetchEvent()}
              className="mt-6 flex-row items-center gap-2 bg-beta dark:bg-alpha px-6 py-3.5 rounded-2xl active:opacity-90"
            >
              <Ionicons name="refresh" size={18} color={onAccentText} />
              <Text className="text-light dark:text-beta font-bold">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerClassName="p-4 pb-10 gap-4"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchEvent(true)}
                tintColor={accentFill}
                colors={[accentFill]}
              />
            }
          >
            <View className="relative">
              <EventCoverImage uri={coverUrl} height={200} borderRadius={20} />
              {statusLabel ? (
                <View className="absolute top-3 right-3">
                  <StatusBadge status={statusLabel} />
                </View>
              ) : null}
            </View>

            {!scannable ? (
              <SectionCard className="p-4">
                <View className="flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-beta/8 dark:bg-light/8 items-center justify-center">
                    <Ionicons name="lock-closed-outline" size={18} color={isDark ? Colors.light : Colors.beta} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-bold text-beta dark:text-light">Scan not available yet</Text>
                    <Text className="text-xs text-beta/55 dark:text-light/55 mt-1 leading-5">
                      QR scanning opens on the event day and stays available until midnight.
                    </Text>
                  </View>
                </View>
              </SectionCard>
            ) : null}

            <SectionCard className="p-4">
              <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-lg bg-beta/15 dark:bg-alpha/15 items-center justify-center">
                    <Ionicons name="people" size={16} color={accentIcon} />
                  </View>
                  <Text className="text-base font-bold text-beta dark:text-light">Registrations</Text>
                </View>
                {capacityLabel ? (
                  <View className="bg-beta/15 dark:bg-alpha/15 px-2.5 py-1 rounded-full">
                    <Text className="text-xs font-bold text-beta dark:text-light">{capacityLabel}</Text>
                  </View>
                ) : (
                  <View className="bg-beta/8 dark:bg-light/8 px-2.5 py-1 rounded-full">
                    <Text className="text-xs font-bold text-beta dark:text-light">{participants.length}</Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-3 mt-3">
                <AttendanceStat
                  icon="person-add-outline"
                  label="Registered"
                  value={registeredCount}
                />
                <AttendanceStat
                  icon="qr-code-outline"
                  label="Came (scanned)"
                  value={scannedCount}
                  tone="good"
                />
              </View>

              {totalCapacity ? (
                <View className="mt-3 mb-1">
                  <View className="h-1.5 rounded-full bg-beta/8 dark:bg-light/8 overflow-hidden">
                    <View
                      className="h-full rounded-full bg-beta dark:bg-alpha"
                      style={{ width: `${capacityFill * 100}%` }}
                    />
                  </View>
                  <Text className="text-[11px] text-beta/45 dark:text-light/45 mt-1.5">
                    {registeredCount} of {totalCapacity} spots filled · {scannedCount} checked in
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] text-beta/45 dark:text-light/45 mt-3">
                  {scannedCount} of {registeredCount} registered visitors checked in
                </Text>
              )}

              {participants.length > 0 ? (
                <View className="flex-row items-center gap-2 mt-4 mb-1 rounded-xl border border-beta/10 dark:border-light/10 bg-beta/4 dark:bg-light/4 px-3">
                  <Ionicons name="search" size={16} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
                  <TextInput
                    value={participantSearch}
                    onChangeText={setParticipantSearch}
                    onFocus={handleSearchFocus}
                    placeholder="Search by name or email…"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                    className="flex-1 min-h-10 py-2 text-sm text-beta dark:text-light"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {participantSearch.length > 0 ? (
                    <Pressable onPress={() => setParticipantSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={16} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <ParticipantsList
                participants={filteredParticipants}
                onParticipantPress={openParticipant}
                emptyMessage={
                  participantSearch
                    ? `No participants match "${participantSearch}".`
                    : undefined
                }
              />
            </SectionCard>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </AppLayout>
  );
}
