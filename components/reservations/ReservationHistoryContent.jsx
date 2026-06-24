import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { format, isValid, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import API from '@/api';

const ACCENT = '#ffcc00';
const BG_TOP = '#12110f';
const BG_BOTTOM = '#0f0e0c';
const CARD = '#1c1b17';
const CARD_BORDER = '#2d2c28';

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      }
    : { elevation: 5 };

function formatDayLabel(dayRaw) {
  if (!dayRaw) return '';
  const s = String(dayRaw).slice(0, 10);
  const d = parseISO(s);
  if (!isValid(d)) return String(dayRaw);
  return format(d, 'EEE, d MMM yyyy');
}

function bookingStatusLine(item) {
  if (item.canceled) return 'Cancelled';
  if (!item.approved) return 'Pending approval';
  return 'Approved';
}

function statusChipStyle(statusLabel) {
  if (statusLabel === 'Cancelled') {
    return { bg: 'bg-rose-950/50', border: 'border-rose-500/35', text: 'text-rose-300' };
  }
  if (statusLabel === 'Pending approval') {
    return { bg: 'bg-amber-950/40', border: 'border-[#ffcc00]/30', text: 'text-[#ffcc00]' };
  }
  return { bg: 'bg-emerald-950/45', border: 'border-emerald-500/30', text: 'text-emerald-300' };
}

function ReservationHistoryRow({ item, mode, onPress }) {
  const subtitleParts = [];
  if (item.day) subtitleParts.push(formatDayLabel(item.day));
  if (item.start && item.end) subtitleParts.push(`${item.start} – ${item.end}`);
  const studioOrDesk =
    mode === 'studio'
      ? item.studio_name || item.type || null
      : item.seats != null
        ? `${item.seats} seat${Number(item.seats) === 1 ? '' : 's'}`
        : null;
  if (studioOrDesk) subtitleParts.push(studioOrDesk);

  const status = bookingStatusLine(item);
  const chip = statusChipStyle(status);

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-4 overflow-hidden rounded-2xl active:opacity-92"
      style={[cardShadow, { backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER }]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 1 }}
      />
      <View className="flex-row items-start px-5 pb-5 pt-5">
        <View className="mr-3.5 h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
          <Ionicons
            name={mode === 'studio' ? 'business-outline' : 'desktop-outline'}
            size={24}
            color={ACCENT}
          />
        </View>
        <View className="min-w-0 flex-1 pr-2">
          <Text className="text-[16px] font-bold leading-6 tracking-tight text-white" numberOfLines={2}>
            {item.title || (mode === 'studio' ? 'Studio booking' : 'Coworking reservation')}
          </Text>
          {item.description && mode === 'studio' ? (
            <Text className="mt-1.5 text-[13px] leading-5 text-white/50" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <Text className="mt-2 text-[13px] leading-5 text-white/45" numberOfLines={2}>
            {subtitleParts.filter(Boolean).join(' · ')}
          </Text>
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <View className={`self-start rounded-full border px-2.5 py-1 ${chip.bg} ${chip.border}`}>
              <Text className={`text-[10px] font-bold uppercase tracking-[0.14em] ${chip.text}`}>{status}</Text>
            </View>
          </View>
        </View>
        <View className="pt-1">
          {mode === 'studio' ? (
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.35)" />
          ) : (
            <Ionicons name="information-circle-outline" size={22} color="rgba(255,255,255,0.35)" />
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ScreenCanvas({ children }) {
  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} locations={[0, 1]} style={{ flex: 1 }}>
      {children}
    </LinearGradient>
  );
}

export default function ReservationHistoryContent({ mode }) {
  const { token } = useAppContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const endpoint = mode === 'studio' ? 'mobile/reservations' : 'mobile/reservationsCowork';

  const load = useCallback(
    async (isRefresh) => {
      if (!token) {
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setError(null);
      if (!isRefresh) setLoading(true);
      try {
        const res = await API.getWithAuth(endpoint, token);
        const list = res?.data?.reservations ?? [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('[RESERVATION_HISTORY]', mode, e);
        setError(mode === 'studio' ? 'Could not load studios history.' : 'Could not load coworking history.');
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, endpoint, mode],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const onRowPress = useCallback(
    (item) => {
      if (mode === 'studio' && item?.id) {
        router.push(`/(tabs)/reservations/${item.id}`);
        return;
      }
      const lines = [
        formatDayLabel(item.day),
        item.start && item.end ? `${item.start} – ${item.end}` : null,
        bookingStatusLine(item),
        item.seats != null ? `Seats: ${item.seats}` : null,
        item.desk_id != null ? `Desk / spot id: ${item.desk_id}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      Alert.alert(item.title || 'Coworking', lines || 'No details', [{ text: 'OK' }]);
    },
    [mode, router],
  );

  const listHeader = (
    <View>
      {error ? (
        <View className="mx-4 mb-3 rounded-2xl border border-rose-500/25 bg-rose-950/35 px-4 py-3">
          <Text className="text-center text-sm text-rose-200/95">{error}</Text>
        </View>
      ) : null}
      <View className="border-b border-white/10 px-4 pb-4 pt-1">
        <Text className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
          {mode === 'studio' ? 'Studios' : 'Coworking'}
        </Text>
        <Text className="mt-1.5 text-[13px] leading-5 text-white/45">
          {mode === 'studio'
            ? 'Your studio reservations · newest first'
            : 'Your desk & cowork bookings · newest first'}
        </Text>
      </View>
    </View>
  );

  const skeletonBlock = (
    <View className="pt-2">
      {Array.from({ length: 6 }).map((_, idx) => (
        <View
          key={idx}
          className="mx-4 mb-4 overflow-hidden rounded-2xl px-5 py-5"
          style={[{ backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER }, cardShadow]}
        >
          <View className="flex-row items-center">
            <Skeleton width={48} height={48} borderRadius={16} isDark />
            <View className="ml-3 flex-1">
              <Skeleton width="55%" height={14} borderRadius={8} isDark />
              <View className="h-2" />
              <Skeleton width="85%" height={12} borderRadius={8} isDark />
              <View className="h-3" />
              <Skeleton width={90} height={22} borderRadius={999} isDark />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  if (!token) {
    return (
      <AppLayout showNavbar={false} className="flex-1">
        <ScreenCanvas>
          <StatusBar style="light" />
          <View className="flex-1 items-center justify-center px-6">
            <View className="rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-10">
              <Ionicons name="lock-closed-outline" size={40} color="rgba(255,204,0,0.55)" />
              <Text className="mt-4 text-center text-base font-semibold text-white">Sign in to continue</Text>
              <Text className="mt-2 max-w-[280px] text-center text-sm leading-5 text-white/50">
                {mode === 'studio'
                  ? 'Studios history shows only your studio reservations after login.'
                  : 'Coworking history is available after login.'}
              </Text>
            </View>
          </View>
        </ScreenCanvas>
      </AppLayout>
    );
  }

  const emptyState = (
    <View className="pt-2">
      <View
        className="mx-4 items-center rounded-2xl border border-dashed py-16 px-6"
        style={{ borderColor: CARD_BORDER, backgroundColor: 'rgba(28,27,23,0.55)' }}
      >
        <View className="rounded-full border border-white/10 bg-white/[0.05] p-4">
          <Ionicons
            name={mode === 'studio' ? 'calendar-outline' : 'desktop-outline'}
            size={36}
            color={ACCENT}
          />
        </View>
        <Text className="mt-5 text-center text-[16px] font-semibold text-white">
          {mode === 'studio' ? 'Your studios history is empty.' : 'No coworking history yet.'}
        </Text>
        <Text className="mt-2 max-w-[280px] text-center text-sm leading-5 text-white/50">
          {mode === 'studio'
            ? 'Only your own studio reservations are listed here.'
            : 'Only coworking slots you booked appear here.'}
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/reservations')}
          className="mt-7 rounded-2xl px-8 py-3.5"
          style={{ backgroundColor: ACCENT }}
        >
          <Text className="text-center text-sm font-bold text-black">Open bookings</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <AppLayout showNavbar={false} className="flex-1">
      <ScreenCanvas>
        <StatusBar style="light" />
        <FlatList
          data={items}
          keyExtractor={(row) => String(row.id)}
          className="flex-1 bg-transparent"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={loading ? skeletonBlock : emptyState}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
          }}
          renderItem={({ item }) => (
            <ReservationHistoryRow item={item} mode={mode} onPress={() => onRowPress(item)} />
          )}
        />
      </ScreenCanvas>
    </AppLayout>
  );
}
