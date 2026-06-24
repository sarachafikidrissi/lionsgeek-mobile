import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  Modal,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';

const WIN = Dimensions.get('window');

const PERIOD_OPTIONS = [
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'all_time', label: 'All time' },
];

function PremiumBackdrop({ width = WIN.width, height = WIN.height }) {
  return (
    <View className="absolute inset-0 pointer-events-none">
      <View className="absolute inset-0">
        <LinearGradient
          colors={['#0B0907', '#161210', '#0B0907']}
          locations={[0, 0.42, 1]}
          style={{ flex: 1 }}
        />
      </View>
      <View className="absolute inset-0 opacity-[0.85]">
        <LinearGradient
          colors={['rgba(55,38,22,0.35)', 'rgba(35,28,20,0.12)', 'rgba(45,32,18,0.28)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>
      <Svg width={width} height={height} className="absolute inset-0">
        <Defs>
          <RadialGradient id="lbGlow" cx="50%" cy="32%" rx="58%" ry="42%">
            <Stop offset="0" stopColor="rgba(255,186,60,0.14)" />
            <Stop offset="0.45" stopColor="rgba(255,170,40,0.04)" />
            <Stop offset="1" stopColor="transparent" />
          </RadialGradient>
          <RadialGradient id="lbVignette" cx="50%" cy="50%" r="68%">
            <Stop offset="0.55" stopColor="transparent" />
            <Stop offset="1" stopColor="rgba(0,0,0,0.72)" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#lbGlow)" />
        <Rect width={width} height={height} fill="url(#lbVignette)" />
      </Svg>
    </View>
  );
}

function formatFirstName(name) {
  if (!name) return '';
  const first = name.trim().split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatDisplayName(name) {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatScore(row) {
  const sec = row.total_seconds ?? row.totalSeconds ?? row.seconds;
  if (typeof sec === 'number' && !Number.isNaN(sec)) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m`;
  }
  if (row.hours != null && row.hours !== '') return `${Number(row.hours).toFixed(1)}h`;
  if (row.score != null && row.score !== '') return String(row.score);
  if (row.total_text) return String(row.total_text);
  return '—';
}

function formatTrend(row) {
  const direct =
    row.trend_label ??
    row.trend_text ??
    row.avg_label ??
    (typeof row.trend === 'string' ? row.trend : null);
  if (direct) return direct.replace(/^↗\s*/, '').replace(/^↘\s*/, '');

  const avg = row.avg_hours ?? row.average_hours ?? row.avg_time_hours;
  if (avg != null && avg !== '') {
    const n = Number(avg);
    if (!Number.isNaN(n)) return `${n % 1 === 0 ? n : n.toFixed(1)}h avg`;
  }

  const delta = row.trend_delta_hours ?? row.delta_hours;
  if (delta != null && delta !== '') {
    return `${Math.abs(Number(delta)).toFixed(1)}h avg`;
  }

  return null;
}

function normalizeLeaderboardPayload(data) {
  if (!data || typeof data !== 'object') return { rows: [], periodLabel: null };
  const raw =
    data.leaderboard ??
    data.rankings ??
    data.users ??
    data.data ??
    (Array.isArray(data) ? data : null);
  const rows = Array.isArray(raw) ? raw : [];
  const periodLabel =
    (typeof data.period_label === 'string' && data.period_label) ||
    (typeof data.period === 'string' && data.period) ||
    (typeof data.range === 'string' && data.range) ||
    null;

  const normalized = rows.map((row, i) => {
    const userObj = row.user ?? {};
    const rank = row.rank ?? row.position ?? row.place ?? i + 1;
    const name =
      row.name ??
      userObj.name ??
      row.username ??
      row.display_name ??
      'Unknown';
    const avatarRaw = row.avatar ?? userObj.avatar ?? row.image ?? userObj.image;
    const userId = row.user_id ?? userObj.id ?? row.id ?? null;

    const promoRaw =
      row.promotion ??
      row.promo ??
      row.promo_name ??
      row.cohort ??
      row.batch ??
      userObj.promotion;
    const promoLabel =
      typeof promoRaw === 'string' && promoRaw.trim()
        ? promoRaw.trim().toUpperCase().startsWith('PROMO')
          ? promoRaw.trim().toUpperCase()
          : `PROMO ${promoRaw}`.replace(/\s+/g, ' ')
        : null;

    return {
      key: String(row.id ?? userId ?? `${rank}-${name}-${i}`),
      rank: typeof rank === 'number' ? rank : i + 1,
      name,
      avatarRaw,
      scoreLabel: formatScore(row),
      trendLabel: formatTrend(row),
      promoLabel,
      userId,
    };
  });

  return { rows: normalized, periodLabel };
}

function padRank(rank) {
  return String(rank).padStart(2, '0');
}

export default function LeaderboardScreen() {
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState([]);
  const [periodLabel, setPeriodLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usedFallback, setUsedFallback] = useState(false);

  const [periodKey, setPeriodKey] = useState(PERIOD_OPTIONS[0].key);
  const [promotionFilter, setPromotionFilter] = useState('all');
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);

  const periodDisplay =
    PERIOD_OPTIONS.find((p) => p.key === periodKey)?.label ?? 'This week';

  const promotionOptions = useMemo(() => {
    const labels = new Set(['All Promotions']);
    rows.forEach((r) => {
      if (r.promoLabel) labels.add(r.promoLabel);
    });
    return [...labels];
  }, [rows]);

  const promotionDisplay =
    promotionFilter === 'all' ? 'All Promotions' : promotionFilter;

  const fetchLeaderboard = useCallback(async () => {
    if (!token) return;
    try {
      const qs = new URLSearchParams();
      qs.set('period', periodKey);
      const endpoint = `mobile/leaderboard?${qs.toString()}`;
      const response = await API.getWithAuth(endpoint, token);
      const payload = response?.data ?? {};
      const { rows: next, periodLabel: pl } = normalizeLeaderboardPayload(payload);
      setRows(next);
      setPeriodLabel(pl);
      setUsedFallback(false);
    } catch (error) {
      console.error('[LEADERBOARD] Fetch Error:', error);
      setRows([]);
      setPeriodLabel(null);
      setUsedFallback(true);
    }
  }, [token, periodKey]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchLeaderboard().finally(() => setLoading(false));
    }
  }, [token, fetchLeaderboard]);

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [fetchLeaderboard]);

  const getAvatarUri = useMemo(
    () => (avatarRaw) => {
      if (!avatarRaw) return null;
      if (typeof avatarRaw === 'string' && avatarRaw.startsWith('http')) return avatarRaw;
      if (typeof avatarRaw === 'string') {
        if (avatarRaw.includes('storage/')) {
          const clean = avatarRaw.startsWith('/') ? avatarRaw : `/${avatarRaw}`;
          return `${API.APP_URL}${clean}`;
        }
        return `${API.APP_URL}/storage/img/profile/${avatarRaw}`;
      }
      return null;
    },
    [],
  );

  const filteredRows = useMemo(() => {
    let list = rows;
    if (promotionFilter !== 'all') {
      list = list.filter((r) => r.promoLabel === promotionFilter);
    }
    return list;
  }, [rows, promotionFilter]);

  const rankMap = useMemo(() => {
    const m = new Map();
    filteredRows.forEach((e) => m.set(e.rank, e));
    return m;
  }, [filteredRows]);

  const podium = useMemo(
    () => ({
      first: rankMap.get(1),
      second: rankMap.get(2),
      third: rankMap.get(3),
    }),
    [rankMap],
  );

  const listBeyondPodium = useMemo(
    () => filteredRows.filter((e) => e.rank > 3).sort((a, b) => a.rank - b.rank),
    [filteredRows],
  );

  const handleRowPress = (entry) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    if (entry.userId) {
      router.push(`/(tabs)/profile?userId=${entry.userId}`);
    }
  };

  const fabBottom = Math.max(insets.bottom, 12) + 52;

  const chevronColor = isDark ? 'rgba(255,210,130,0.78)' : 'rgba(33,37,41,0.55)';

  const renderPickerModal = (visible, onClose, title, options, onSelect, selectedLabel) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-center bg-black/55 px-7"
        onPress={onClose}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            className="rounded-2xl overflow-hidden border border-black/10 bg-white py-2 dark:border-lb-border dark:bg-lb-card"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="px-4 py-3.5 text-base font-extrabold text-beta dark:text-lb-text">
              {title}
            </Text>
            {options.map((opt) => {
              const label = typeof opt === 'string' ? opt : opt.label;
              const key = typeof opt === 'string' ? opt : opt.key;
              const selected =
                typeof opt === 'string' ? selectedLabel === label : selectedLabel === key;
              return (
                <TouchableOpacity
                  key={typeof opt === 'string' ? label : key}
                  className={`mx-2 my-0.5 flex-row items-center justify-between rounded-xl px-4 py-3.5 ${
                    selected ? 'bg-alpha/15' : ''
                  }`}
                  onPress={() => {
                    onSelect(typeof opt === 'string' ? label : opt);
                    onClose();
                  }}
                >
                  <Text
                    className={`flex-1 text-base font-semibold ${
                      selected ? 'text-alpha' : 'text-beta dark:text-lb-text'
                    }`}
                  >
                    {label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.alpha} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );

  const PodiumSlot = ({ slotRank, entry, isFirst }) => {
    const uri = entry ? getAvatarUri(entry.avatarRaw) : null;
    const orderClass = slotRank === 1 ? 'order-2' : slotRank === 2 ? 'order-1' : 'order-3';
    const glowClass =
      slotRank === 1
        ? 'shadow-lb-gold'
        : slotRank === 2
          ? 'shadow-lb-silver'
          : 'shadow-lb-bronze';
    const ringClass =
      slotRank === 1
        ? 'border-4 border-alpha'
        : slotRank === 2
          ? 'border-[3px] border-lb-ring2'
          : 'border-[3px] border-lb-ring3';

    const ringBoxClass = isFirst
      ? 'h-[102px] w-[102px] rounded-full'
      : 'h-[72px] w-[72px] rounded-full';

    return (
      <Pressable
        onPress={() => entry && handleRowPress(entry)}
        disabled={!entry?.userId}
        className={`max-w-[118px] flex-1 items-center ${orderClass} ${isFirst ? 'mb-[18px]' : ''}`}
        style={({ pressed }) => (pressed && entry?.userId ? { opacity: 0.92 } : undefined)}
      >
        {isFirst ? (
          <View className="mb-0.5 h-7 items-center justify-end">
            <FontAwesome5 name="crown" size={24} color={Colors.alpha} />
          </View>
        ) : (
          <View className="h-2.5" />
        )}

        <View className={`mb-3 items-center ${glowClass}`}>
          <View className={`relative items-center justify-center ${ringBoxClass} ${ringClass}`}>
            {uri ? (
              <Image
                source={{ uri }}
                className={
                  isFirst ? 'h-[90px] w-[90px] rounded-full' : 'h-16 w-16 rounded-full'
                }
              />
            ) : (
              <View
                className={`items-center justify-center rounded-full bg-lb-timebox ${
                  isFirst ? 'h-[90px] w-[90px]' : 'h-16 w-16'
                }`}
              >
                <Ionicons name="person" size={isFirst ? 38 : 27} color="#8a8278" />
              </View>
            )}
            {slotRank === 1 ? (
              <View className="absolute -bottom-2.5 min-w-[36px] self-center rounded-xl border-2 border-light bg-alpha px-2.5 py-0.5 dark:border-lb-bg">
                <Text className="text-center text-[11px] font-black text-beta">1st</Text>
              </View>
            ) : (
              <View
                className={`absolute -bottom-2 h-[26px] w-[26px] self-center rounded-full border-2 border-light items-center justify-center dark:border-lb-bg ${
                  slotRank === 2 ? 'bg-lb-rank2' : 'bg-lb-rank3'
                }`}
              >
                <Text className="text-[12px] font-black text-neutral-100">{slotRank}</Text>
              </View>
            )}
          </View>
        </View>

        {entry ? (
          <>
            <Text
              className={`mt-1.5 text-center text-beta dark:text-lb-text ${
                isFirst ? 'text-[15px] font-extrabold uppercase tracking-widest' : 'text-sm font-bold'
              }`}
              numberOfLines={1}
            >
              {isFirst
                ? entry.name.split(' ')[0].toUpperCase()
                : formatFirstName(entry.name)}
            </Text>
            {slotRank === 1 ? (
              <View className="mt-2.5 w-full items-center rounded-xl border-[1.5px] border-alpha bg-black/10 px-3 py-2.5 shadow-lb-gold dark:bg-black/40">
                <Text className="font-space text-[15px] font-bold text-alpha">{entry.scoreLabel}</Text>
              </View>
            ) : (
              <View className="mt-2.5 w-full items-center rounded-xl border border-black/10 bg-neutral-100 px-3 py-2.5 dark:border-lb-soft dark:bg-lb-timebox">
                <Text
                  className={`font-space text-[13px] font-bold text-beta ${
                    slotRank === 2
                      ? 'dark:text-[rgba(245,242,236,0.92)]'
                      : slotRank === 3
                        ? 'dark:text-[rgba(245,240,232,0.9)]'
                        : 'dark:text-lb-muted'
                  }`}
                >
                  {entry.scoreLabel}
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text className="mt-2 text-lb-dim">—</Text>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <View
          className={`flex-1 px-5 pt-3 ${isDark ? 'bg-lb-bg' : 'bg-light'}`}
        >
          {isDark ? <PremiumBackdrop /> : null}
          <Skeleton width={200} height={32} borderRadius={12} isDark={isDark} />
          <View className="h-2" />
          <Skeleton width={280} height={14} borderRadius={8} isDark={isDark} />
          <View className="h-6" />
          <Skeleton width="100%" height={130} borderRadius={16} isDark={isDark} />
          <View className="h-4" />
          <View className="flex-row gap-2.5">
            <Skeleton width="48%" height={44} borderRadius={14} isDark={isDark} />
            <Skeleton width="48%" height={44} borderRadius={14} isDark={isDark} />
          </View>
          <View className="h-5" />
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} className="mb-2.5">
              <Skeleton width="100%" height={82} borderRadius={20} isDark={isDark} />
            </View>
          ))}
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View className={`relative flex-1 ${isDark ? 'bg-lb-bg' : 'bg-light'}`}>
        {isDark ? <PremiumBackdrop /> : null}
        <ScrollView
          className="flex-1 bg-transparent"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.alpha}
              colors={[Colors.alpha]}
            />
          }
          contentContainerClassName="px-5 pt-2.5 pb-[120px]"
          contentContainerStyle={{ paddingBottom: fabBottom + 64 }}
        >
          <Text className="mb-3 text-[10px] font-bold uppercase tracking-[3.2px] text-neutral-500 dark:text-lb-section">
            THIS WEEK
          </Text>

          <View className="mb-5 flex-row gap-3">
            <Pressable
              onPress={() => setPeriodModalOpen(true)}
              className="min-h-[44px] flex-1 flex-row items-center justify-between rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm dark:border-lb-border dark:bg-lb-pill dark:shadow-lb-pill"
              style={({ pressed }) => (pressed ? { opacity: 0.88 } : undefined)}
            >
              <Text
                className="mr-2 flex-1 text-sm font-semibold text-beta dark:text-[rgba(248,245,238,0.95)]"
                numberOfLines={1}
              >
                {periodDisplay}
              </Text>
              <Ionicons name="chevron-down" size={18} color={chevronColor} />
            </Pressable>
            <Pressable
              onPress={() => setPromoModalOpen(true)}
              className="min-h-[44px] flex-1 flex-row items-center justify-between rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm dark:border-lb-border dark:bg-lb-pill dark:shadow-lb-pill"
              style={({ pressed }) => (pressed ? { opacity: 0.88 } : undefined)}
            >
              <Text
                className="mr-2 flex-1 text-sm font-semibold text-beta dark:text-[rgba(248,245,238,0.95)]"
                numberOfLines={1}
              >
                {promotionDisplay}
              </Text>
              <Ionicons name="chevron-down" size={18} color={chevronColor} />
            </Pressable>
          </View>

          {periodLabel ? (
            <Text className="mb-3 text-center text-xs text-neutral-500 dark:text-lb-dim">
              {periodLabel}
            </Text>
          ) : null}

          {filteredRows.length >= 1 && !usedFallback ? (
            <Text className="mb-3.5 mt-2 text-[10px] font-bold uppercase tracking-[3.2px] text-neutral-500 dark:text-lb-section">
              THIS WEEK
            </Text>
          ) : null}

          {filteredRows.length >= 1 && !usedFallback ? (
            <View className="mb-8 flex-row items-end justify-center gap-2.5 px-0.5">
              <PodiumSlot slotRank={2} entry={podium.second} isFirst={false} />
              <PodiumSlot slotRank={1} entry={podium.first} isFirst />
              <PodiumSlot slotRank={3} entry={podium.third} isFirst={false} />
            </View>
          ) : null}

          {usedFallback && rows.length === 0 ? (
            <EmptyBlock
              iconColor={isDark ? 'rgba(200,190,175,0.72)' : 'rgba(33,37,41,0.55)'}
              icon="cloud-offline-outline"
              title="Could not load leaderboard"
              subtitle="Pull down to refresh."
            />
          ) : filteredRows.length === 0 ? (
            <EmptyBlock
              iconColor={isDark ? 'rgba(200,190,175,0.72)' : 'rgba(33,37,41,0.55)'}
              icon="trophy-outline"
              title="No rankings yet"
              subtitle="Check back soon."
            />
          ) : (
            <>
              {listBeyondPodium.length > 0 ? (
                <>
                  <View className="mb-3.5 mt-3 flex-row items-center justify-between">
                    <Text className="text-[10px] font-bold uppercase tracking-[3px] text-neutral-500 dark:text-lb-section">
                      THIS WEEK
                    </Text>
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="sparkles" size={15} color="#4ade80" />
                      <Text className="text-[10px] font-extrabold uppercase tracking-wider text-lb-neon">
                        REAL-TIME UPDATES
                      </Text>
                    </View>
                  </View>
                  {listBeyondPodium.map((entry, index) => {
                    const uri = getAvatarUri(entry.avatarRaw);
                    const isSelf =
                      user?.id != null &&
                      entry.userId != null &&
                      String(entry.userId) === String(user.id);
                    const showOnlineDot = index === 0;

                    return (
                      <Pressable
                        key={entry.key}
                        onPress={() => handleRowPress(entry)}
                        disabled={!entry.userId}
                        className="relative mb-3 min-h-[82px] flex-row items-center overflow-hidden rounded-[20px] border border-black/[0.08] bg-white px-4 py-3.5 shadow-sm dark:border-lb-border dark:bg-lb-list dark:shadow-lb"
                        style={({ pressed }) =>
                          pressed && entry.userId ? { opacity: 0.92 } : undefined
                        }
                      >
                        {isDark ? (
                          <View className="absolute left-4 right-4 top-0 h-px rounded-sm bg-lb-glassline" />
                        ) : null}
                        <Text className="w-10 font-space text-lg font-extrabold tracking-tight text-neutral-600 dark:text-lb-beige">
                          {padRank(entry.rank)}
                        </Text>
                        <View className="mr-3">
                          <View>
                            {uri ? (
                              <Image
                                source={{ uri }}
                                className="h-[46px] w-[46px] rounded-[23px]"
                              />
                            ) : (
                              <View className="h-[46px] w-[46px] items-center justify-center rounded-[23px] bg-lb-timebox dark:bg-lb-timebox">
                                <Text className="text-sm font-extrabold text-beta dark:text-lb-text">
                                  {entry.name
                                    .split(' ')
                                    .map((p) => p[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </Text>
                              </View>
                            )}
                            {showOnlineDot ? (
                              <View className="absolute bottom-0.5 right-0.5 h-[11px] w-[11px] rounded-[6px] border-2 border-white bg-lb-neon shadow-lb-online dark:border-[rgba(24,20,18,0.95)]" />
                            ) : null}
                          </View>
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="text-[15px] font-bold tracking-wide text-beta dark:text-lb-text" numberOfLines={1}>
                            {formatDisplayName(entry.name)}
                            {isSelf ? (
                              <Text className="text-xs font-bold text-alpha"> · YOU</Text>
                            ) : null}
                          </Text>
                          {entry.promoLabel ? (
                            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-lb-muted">
                              {entry.promoLabel}
                            </Text>
                          ) : (
                            <Text className="mt-1 text-xs text-neutral-400 dark:text-lb-dim">—</Text>
                          )}
                        </View>
                        <View className="min-w-[86px] items-end">
                          <Text className="font-space text-[15px] font-bold text-beta dark:text-lb-text">
                            {entry.scoreLabel}
                          </Text>
                          {entry.trendLabel ? (
                            <Text className="mt-1 text-[11px] font-semibold text-neutral-500 dark:text-lb-muted">
                              {entry.trendLabel}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
            </>
          )}
        </ScrollView>

        <Pressable
          onPress={onRefresh}
          className="absolute right-[18px] h-[58px] w-[58px] items-center justify-center rounded-full bg-alpha shadow-lb-fab"
          style={({ pressed }) => ({
            bottom: fabBottom,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
          })}
          accessibilityRole="button"
          accessibilityLabel="Refresh leaderboard"
        >
          <Ionicons name="flash" size={26} color={Colors.beta} />
        </Pressable>

        {renderPickerModal(
          periodModalOpen,
          () => setPeriodModalOpen(false),
          'Period',
          PERIOD_OPTIONS,
          (opt) => setPeriodKey(opt.key),
          periodKey,
        )}

        {renderPickerModal(
          promoModalOpen,
          () => setPromoModalOpen(false),
          'Promotion',
          promotionOptions.map((label) => ({
            key: label === 'All Promotions' ? 'all' : label,
            label,
          })),
          (opt) => setPromotionFilter(opt.key),
          promotionFilter === 'all' ? 'all' : promotionFilter,
        )}
      </View>
    </AppLayout>
  );
}

function EmptyBlock({ iconColor, icon = 'cloud-offline-outline', title, subtitle }) {
  return (
    <View className="items-center px-4 py-9">
      <Ionicons name={icon} size={40} color={iconColor} style={{ opacity: 0.65 }} />
      <Text className="mt-3 text-center text-lg font-bold text-neutral-500 dark:text-lb-muted">
        {title}
      </Text>
      <Text className="mt-1.5 text-center text-sm text-neutral-400 dark:text-lb-dim">{subtitle}</Text>
    </View>
  );
}
