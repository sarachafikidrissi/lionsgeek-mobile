import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { formatDistanceToNow, parse } from 'date-fns';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import API from '@/api';

const FILTER_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'likes', label: 'Likes' },
  { id: 'comments', label: 'Comments' },
  { id: 'saves', label: 'Saved' },
  { id: 'posts', label: 'Posts' },
  { id: 'reposts', label: 'Reposts' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'follows', label: 'Follows' },
];

const ACCENT = '#F5C518';

function parseOccurredAt(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return parse(raw, 'yyyy-MM-dd HH:mm:ss', new Date());
  } catch {
    try {
      return new Date(raw);
    } catch {
      return null;
    }
  }
}

function activityIcon(type) {
  switch (type) {
    case 'post_like':
    case 'comment_like':
      return 'heart';
    case 'comment':
      return 'chatbubble-outline';
    case 'save':
      return 'bookmark';
    case 'post':
      return 'document-text-outline';
    case 'repost':
      return 'repeat-outline';
    case 'reservation':
      return 'calendar-outline';
    case 'cowork':
      return 'desktop-outline';
    case 'follow':
      return 'person-add-outline';
    default:
      return 'ellipse-outline';
  }
}

function activityHeadline(item) {
  switch (item.type) {
    case 'post_like':
      return 'You liked a post';
    case 'comment_like':
      return 'You liked a comment';
    case 'comment':
      return 'You commented';
    case 'save':
      return 'You saved a post';
    case 'post':
      return 'You published a post';
    case 'repost':
      return 'You reposted';
    case 'reservation':
      return 'Studio reservation';
    case 'cowork':
      return 'Cowork reservation';
    case 'follow': {
      const name = item.follow?.name?.trim();
      return name ? `You followed ${name}` : 'You followed someone';
    }
    default:
      return 'Activity';
  }
}

function activitySubtitle(item) {
  if (item.type === 'follow' && item.follow?.name) {
    return null;
  }
  if (item.booking?.title) {
    const bits = [];
    if (item.booking.day) bits.push(item.booking.day);
    const range =
      item.booking.start && item.booking.end ? `${item.booking.start}–${item.booking.end}` : '';
    if (range) bits.push(range);
    let status = '';
    if (item.booking.canceled) status = 'Cancelled';
    else if (!item.booking.approved) status = 'Pending approval';
    const base = bits.length ? bits.join(' · ') : '';
    return [base, status].filter(Boolean).join(status ? ' · ' : '');
  }
  return item.comment?.snippet || item.post?.snippet || '';
}

function ActivityRow({ item, onPress }) {
  const iconName = activityIcon(item.type);
  const occurred = parseOccurredAt(item.occurred_at);
  const relative = occurred ? formatDistanceToNow(occurred, { addSuffix: true }) : '';

  const thumbUri = item.post?.thumbnail_url || item.follow?.avatar_url || null;

  return (
    <TouchableOpacity
      activeOpacity={0.72}
      onPress={() => onPress(item)}
      className="flex-row px-4 py-3.5 bg-white dark:bg-[#1c1c1c] border-y border-black/10 dark:border-white/10"
    >
      <View className="h-11 w-11 rounded-2xl items-center justify-center bg-alpha/14 dark:bg-alpha/18 mr-3">
        <Ionicons name={iconName} size={22} color={ACCENT} />
      </View>
      <View className="flex-1 min-w-0 pr-3">
        <Text className="text-[14px] font-bold text-black dark:text-white" numberOfLines={2}>
          {activityHeadline(item)}
        </Text>
        {activitySubtitle(item) ? (
          <Text className="text-[13px] text-black/58 dark:text-white mt-0.5" numberOfLines={2}>
            {activitySubtitle(item)}
          </Text>
        ) : null}
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/80 mt-1.5">
          {relative}
        </Text>
      </View>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} className="w-14 h-14 rounded-xl bg-black/10 dark:bg-white/10" />
        ) : item.type === 'follow' && item.follow?.name ? (
          <View className="w-14 h-14 rounded-xl bg-alpha/20 dark:bg-alpha/25 items-center justify-center border border-alpha/40">
            <Text className="text-lg font-extrabold text-alpha">{item.follow.name.charAt(0).toUpperCase()}</Text>
          </View>
        ) : null}
    </TouchableOpacity>
  );
}

export default function ActivityScreen() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [filter, setFilter] = useState('all');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextOffset, setNextOffset] = useState(null);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(
    async ({ append, offset: startOffset }) => {
      if (!token) return;
      setError(null);
      const qs = `mobile/activity?filter=${encodeURIComponent(filter)}&offset=${startOffset}&limit=25`;
      const res = await API.getWithAuth(qs, token);
      const list = Array.isArray(res?.data?.activities) ? res.data.activities : [];
      const next = res?.data?.next_offset;
      setNextOffset(typeof next === 'number' ? next : null);

      setActivities((prev) => {
        if (append) return [...prev, ...list];
        return list;
      });
    },
    [token, filter],
  );

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setActivities([]);
        setLoading(false);
        setNextOffset(null);
        setError(null);
        return;
      }
      setLoading(true);
      setActivities([]);
      setNextOffset(null);
      try {
        await fetchPage({ append: false, offset: 0 });
      } catch (e) {
        if (!cancelled) {
          console.error('[ACTIVITY]', e);
          setError('Could not load activity.');
          setActivities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, filter, fetchPage]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      setNextOffset(null);
      await fetchPage({ append: false, offset: 0 });
    } catch {
      setError('Could not load activity.');
    } finally {
      setRefreshing(false);
    }
  }, [token, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!token || nextOffset === null || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchPage({ append: true, offset: nextOffset });
    } catch {
      setError('Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  }, [token, nextOffset, loading, loadingMore, fetchPage]);

  const handleRowPress = useCallback((item) => {
    switch (item.type) {
      case 'comment':
      case 'comment_like': {
        const pid = item.post?.id;
        const cid = item.comment?.id;
        if (pid && cid) {
          router.push(`/posts/${pid}?commentId=${cid}`);
        } else if (pid) {
          router.push(`/posts/${pid}`);
        }
        break;
      }
      case 'post_like':
      case 'save':
      case 'post':
      case 'repost':
        if (item.post?.id) {
          router.push(`/posts/${item.post.id}`);
        }
        break;
      case 'reservation':
      case 'cowork':
        router.push('/(tabs)/reservations');
        break;
      case 'follow':
        if (item.follow?.user_id) {
          router.push({ pathname: '/(tabs)/profile', params: { userId: String(item.follow.user_id) } });
        }
        break;
      default:
        break;
    }
  }, []);

  const skeleton = (
    <View className="pt-2 px-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <View
          key={idx}
          className="flex-row py-3.5 mb-2 bg-white dark:bg-[#1c1c1c] rounded-2xl border border-black/[0.07] dark:border-white/10 px-3 items-center"
        >
          <Skeleton width={44} height={44} borderRadius={16} isDark={isDark} />
          <View className="ml-3 flex-1">
            <Skeleton width={120} height={14} borderRadius={8} isDark={isDark} />
            <View className="h-2" />
            <Skeleton width={200} height={12} borderRadius={8} isDark={isDark} />
          </View>
        </View>
      ))}
    </View>
  );

  if (!token) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 bg-light dark:bg-dark items-center justify-center px-8 pb-6">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-black/5 dark:bg-white/10">
            <Ionicons
              name="time-outline"
              size={32}
              color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
            />
          </View>
          <Text className="text-base font-semibold text-black dark:text-white text-center">
            Sign in to see your activity
          </Text>
          <Text className="text-sm text-black/55 dark:text-white/55 text-center mt-2">
            Likes, comments, bookings, and more — excluding messages — stay on this timeline.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
            className="mt-6 px-6 py-3 rounded-xl bg-alpha"
            activeOpacity={0.85}
          >
            <Text className="text-sm font-bold text-black">Go to login</Text>
          </TouchableOpacity>
        </View>
      </AppLayout>
    );
  }

  const pillHeader = (
    <View className="pb-2 pt-1 bg-light dark:bg-dark border-b border-black/[0.06] dark:border-white/10">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 4 }}
      >
        {FILTER_PILLS.map((p) => {
          const selected = filter === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.75}
              onPress={() => setFilter(p.id)}
              className={`px-3.5 py-2 rounded-full border ${
                selected
                  ? 'bg-alpha border-alpha'
                  : 'border-black/[0.1] bg-white dark:border-white/14 dark:bg-[#1f1f1f]'
              }`}
            >
              <Text
                className={`text-[13px] font-semibold ${selected ? 'text-black' : 'text-black/75 dark:text-white'}`}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {error ? (
        <Text className="text-xs text-black/65 dark:text-white text-center px-4 pt-1">{error}</Text>
      ) : null}
    </View>
  );

  return (
    <AppLayout showNavbar={false}>
      <FlatList
        data={activities}
        keyExtractor={(item) => `${item.type}-${item.source_id}`}
        className="flex-1 bg-light dark:bg-dark"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />
        }
        ListHeaderComponent={pillHeader}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : (
            <View className="h-6" />
          )
        }
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          loading ? (
            skeleton
          ) : (
            <View className="bg-white dark:bg-[#1c1c1c] mt-2 mx-4 rounded-3xl py-14 px-6 items-center border border-black/[0.07] dark:border-white/12">
              <Ionicons
                name="time-outline"
                size={48}
                color={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)'}
              />
              <Text className="text-black/65 dark:text-white text-center mt-4 font-semibold">
                Nothing in this tab yet.
              </Text>
              <Text className="text-black/45 dark:text-white/90 text-center mt-2 text-sm">
                Actions from the feed, saves, bookings, and follows show up here. Messages stay in chat.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <ActivityRow item={item} onPress={handleRowPress} />}
      />
    </AppLayout>
  );
}
