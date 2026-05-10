import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import FeedItem from '@/components/feed/FeedItem';
import Skeleton from '@/components/ui/Skeleton';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import {
  parseSavedPostsFromApiResponse,
  normalizeSavedPostsList,
} from '@/components/helpers/helpers';

export default function SavedPostsScreen() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadSavedPosts = useCallback(async () => {
    if (!token) {
      setPosts([]);
      setLoading(false);
      setError(null);
      return;
    }

    setError(null);
    try {
      const res = await API.getWithAuth('mobile/posts/saved', token);
      const list = parseSavedPostsFromApiResponse(res);
      setPosts(normalizeSavedPostsList(list));
    } catch (err) {
      console.error('[SAVED_POSTS] fetch error:', err);
      setPosts([]);
      setError('Could not load saved posts. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    loadSavedPosts();
  }, [loadSavedPosts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSavedPosts();
  }, [loadSavedPosts]);

  const renderSkeleton = () => (
    <View className="pt-2.5">
      {Array.from({ length: 4 }).map((_, idx) => (
        <View
          key={idx}
          className="bg-white dark:bg-[#1c1c1c] mb-2 border-y border-black/10 dark:border-white/10 pb-3.5"
        >
          <View className="px-3 pt-3.5 pb-2.5 flex-row items-center">
            <Skeleton width={42} height={42} borderRadius={21} isDark={isDark} />
            <View className="ml-2.5 flex-1">
              <Skeleton width={160} height={12} borderRadius={8} isDark={isDark} />
              <View className="h-2" />
              <Skeleton width={90} height={10} borderRadius={8} isDark={isDark} />
            </View>
          </View>
          <Skeleton width="100%" height={360} borderRadius={0} isDark={isDark} />
          <View className="px-3 pt-3">
            <View className="flex-row justify-between items-center">
              <View className="flex-row">
                <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                <View className="w-3" />
                <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                <View className="w-3" />
                <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
              </View>
              <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
            </View>
            <View className="h-2.5" />
            <Skeleton width={140} height={12} borderRadius={8} isDark={isDark} />
          </View>
        </View>
      ))}
    </View>
  );

  if (!token) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 bg-light dark:bg-dark items-center justify-center px-8 pb-6">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-black/5 dark:bg-white/10"
          >
            <Ionicons
              name="bookmark-outline"
              size={32}
              color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
            />
          </View>
          <Text className="text-base font-semibold text-black dark:text-white text-center">
            Sign in to see saved posts
          </Text>
          <Text className="text-sm text-black/55 dark:text-white/55 text-center mt-2">
            Your bookmarks sync to your account.
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

  return (
    <AppLayout showNavbar={false}>
      <FlatList
        data={posts}
        keyExtractor={(item) =>
          String(item?.repost_entry_id ?? item?.interaction_post_id ?? item?.id)
        }
        className="flex-1 bg-light dark:bg-dark"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />
        }
        ListFooterComponent={<View className="h-6" />}
        ListHeaderComponent={
          error ? (
            <View className="px-4 pt-3 pb-1">
              <Text className="text-sm text-black/65 dark:text-white/65 text-center">{error}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            renderSkeleton()
          ) : (
            <View className="bg-white dark:bg-[#1c1c1c] mt-2 py-12 items-center">
              <Ionicons
                name="bookmark-outline"
                size={48}
                color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              />
              <Text className="text-black/60 dark:text-white/60 text-center mt-4 px-4">
                No saved posts yet. Save something from your feed to see it here.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <FeedItem
            item={{
              ...item,
              onPostDeleted: (postId) => {
                setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
              },
              onBookmarkChange: (saved) => {
                if (!saved) {
                  setPosts((prev) => prev.filter((p) => String(p.id) !== String(item.id)));
                }
              },
            }}
          />
        )}
      />
    </AppLayout>
  );
}
