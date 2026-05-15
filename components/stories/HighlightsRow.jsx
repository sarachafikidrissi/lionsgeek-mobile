import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppContext } from '@/context';
import API from '@/api';

/**
 * Horizontal row of highlight circles shown on a profile page.
 *
 * Props:
 *   userId          – the profile being viewed (highlights belong to them)
 *   isOwnProfile    – when true, prepends a "+ New" tile for quick creation
 *   isDark          – light/dark theme toggle
 *   refreshKey      – bumping this re-fetches the list
 */
export default function HighlightsRow({ userId, isOwnProfile, isDark, refreshKey }) {
  const { token } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [highlights, setHighlights] = useState([]);

  const load = useCallback(async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const data = await API.listHighlights(userId, token);
      setHighlights(Array.isArray(data?.highlights) ? data.highlights : []);
    } catch (_) {
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Long-press own highlight → confirm delete
  const handleLongPress = useCallback((h) => {
    if (!isOwnProfile) return;
    Alert.alert(
      h.title,
      'What do you want to do with this highlight?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.deleteHighlight(h.id, token);
              setHighlights((prev) => prev.filter((x) => x.id !== h.id));
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not delete.');
            }
          },
        },
      ],
    );
  }, [isOwnProfile, token]);

  const showNewTile = isOwnProfile;

  // Hide entirely if there's nothing to show and it's not your profile.
  if (!showNewTile && !loading && highlights.length === 0) return null;

  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}
      >
        {showNewTile ? (
          <Pressable
            onPress={() => {
              // Tell the user how to add — they can't create from scratch
              // without an existing story.
              Alert.alert(
                'Add to highlights',
                'Open one of your active stories and tap the bookmark icon to save it as a new highlight.',
              );
            }}
            style={({ pressed }) => [tileWrap, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[circle, {
              borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              alignItems: 'center', justifyContent: 'center',
            }]}>
              <Ionicons name="add" size={28} color={isDark ? '#fff' : '#000'} />
            </View>
            <Text
              numberOfLines={1}
              style={{ marginTop: 6, fontSize: 11, color: isDark ? '#fff' : '#000', textAlign: 'center', maxWidth: 64 }}
            >
              New
            </Text>
          </Pressable>
        ) : null}

        {loading && highlights.length === 0 ? (
          <View style={{ paddingVertical: 16, paddingHorizontal: 6 }}>
            <ActivityIndicator color={isDark ? '#fff' : '#000'} />
          </View>
        ) : null}

        {highlights.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => router.push(`/stories/highlight/${h.id}`)}
            onLongPress={() => handleLongPress(h)}
            delayLongPress={400}
            style={({ pressed }) => [tileWrap, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[circle, {
              borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.18)',
              overflow: 'hidden',
            }]}>
              {h.cover_url ? (
                <Image source={{ uri: h.cover_url }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{
                  width: '100%', height: '100%',
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                }}>
                  <Ionicons name="albums-outline" size={22} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'} />
                </View>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{ marginTop: 6, fontSize: 11, color: isDark ? '#fff' : '#000', textAlign: 'center', maxWidth: 64 }}
            >
              {h.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const tileWrap = {
  width: 64,
  alignItems: 'center',
};

const circle = {
  width: 64,
  height: 64,
  borderRadius: 32,
  borderWidth: 1.5,
};
