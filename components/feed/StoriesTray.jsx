import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import StoryItem from '@/components/feed/StoryItem';
import Skeleton from '@/components/ui/Skeleton';
import API from '@/api';

/**
 * Horizontally-scrolling Stories tray for the home feed.
 *
 * - Fetches /api/mobile/stories on mount + on `refreshKey` change.
 * - Pre-pends a "Your story" tile that either:
 *     - opens the viewer for your own stories, OR
 *     - opens the create flow if you have none.
 * - Long-press your own tile also opens the create flow as a shortcut.
 */
export default function StoriesTray({ refreshKey = 0 }) {
  const { user, token } = useAppContext();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await API.listStories(token);
      setGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (e) {
      console.warn('[StoriesTray] failed to load:', e?.message);
      setError(e?.message || 'Failed');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const myGroup = groups.find((g) => Number(g.user?.id) === Number(user?.id));
  const others = groups.filter((g) => Number(g.user?.id) !== Number(user?.id));

  const openViewer = (startUserId) => {
    if (!groups.length) return;
    router.push({
      pathname: '/stories/viewer',
      params: { startUserId: String(startUserId) },
    });
  };

  const openCreate = () => router.push('/stories/create');

  return (
    <View style={{
      backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 14,
    }}>
      <View className="flex-row items-center justify-between mb-3">
        <Text style={{
          fontSize: 12, fontWeight: '700', letterSpacing: 0.8,
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
        }}>
          Stories
        </Text>
        <Ionicons
          name="add-circle-outline"
          size={22}
          color="#ffc801"
          onPress={openCreate}
          suppressHighlighting
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {/* Your story tile – always first. */}
        <StoryItem
          user={user}
          isOwn
          hasStories={!!myGroup}
          hasUnseen={myGroup ? !!myGroup.has_unseen : false}
          onPress={() => (myGroup ? openViewer(user?.id) : openCreate())}
        />

        {loading ? (
          <View style={{ flexDirection: 'row' }}>
            {[1, 2, 3, 4].map((n) => (
              <View key={n} style={{ width: 76, marginRight: 12, alignItems: 'center' }}>
                <Skeleton width={72} height={72} borderRadius={36} isDark={isDark} />
                <View style={{ height: 6 }} />
                <Skeleton width={56} height={10} borderRadius={6} isDark={isDark} />
              </View>
            ))}
          </View>
        ) : others.length === 0 ? null : (
          others.map((g) => (
            <StoryItem
              key={g.user.id}
              user={g.user}
              hasStories
              hasUnseen={!!g.has_unseen}
              onPress={() => openViewer(g.user.id)}
            />
          ))
        )}
      </ScrollView>

      {error ? (
        <Text style={{
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          fontSize: 11, marginTop: 6,
        }}>
          Could not load stories. Pull to refresh.
        </Text>
      ) : null}
    </View>
  );
}
