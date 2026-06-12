import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';

const TOP_INSET = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;

/**
 * Close Friends manager.
 *
 * Lets the auth user pick who's on their close-friends list. The candidate
 * pool is "people you follow" (so we don't expose strangers). Tapping a
 * row toggles membership with optimistic state updates.
 */
export default function CloseFriendsScreen() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await API.listCloseFriends(token);
      const closeIds = new Set((data?.close_friends || []).map((u) => u.id));
      const list = (data?.candidates || []).map((u) => ({
        ...u,
        is_close: closeIds.has(u.id),
      }));
      // Also include close-friends that aren't in candidates (e.g. we unfollowed).
      const candIds = new Set(list.map((u) => u.id));
      (data?.close_friends || []).forEach((u) => {
        if (!candIds.has(u.id)) list.push({ ...u, is_close: true });
      });
      setCandidates(list);
    } catch (_) {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (u) => {
    if (!token || pendingIds.has(u.id)) return;
    const wasClose = u.is_close;
    setPendingIds((s) => new Set(s).add(u.id));
    // Optimistic flip
    setCandidates((prev) => prev.map((x) => x.id === u.id ? { ...x, is_close: !wasClose } : x));
    try {
      if (wasClose) {
        await API.removeCloseFriend(u.id, token);
      } else {
        await API.addCloseFriend(u.id, token);
      }
    } catch (e) {
      // Revert on failure
      setCandidates((prev) => prev.map((x) => x.id === u.id ? { ...x, is_close: wasClose } : x));
      Alert.alert('Error', e?.message || 'Could not update close friends.');
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(u.id); return n; });
    }
  }, [token, pendingIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((u) => (u.name || '').toLowerCase().includes(q));
  }, [candidates, query]);

  const closeCount = candidates.filter((u) => u.is_close).length;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={{
        paddingTop: TOP_INSET,
        paddingHorizontal: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#000'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isDark ? '#fff' : '#000', fontSize: 17, fontWeight: '800' }}>
            Close Friends
          </Text>
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)', fontSize: 11, marginTop: 2 }}>
            {closeCount} {closeCount === 1 ? 'person' : 'people'} on your list
          </Text>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 5,
          backgroundColor: 'rgba(34,197,94,0.18)',
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
        }}>
          <Ionicons name="star" size={12} color="#22c55e" />
          <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '700' }}>List</Text>
        </View>
      </View>

      {/* Search */}
      <View style={{
        marginHorizontal: 14, marginVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      }}>
        <Ionicons name="search" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search"
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'}
          style={{
            flex: 1,
            color: isDark ? '#fff' : '#000',
            fontSize: 14,
            paddingVertical: 0,
          }}
        />
      </View>

      {/* Helper text */}
      <Text style={{
        paddingHorizontal: 18, paddingBottom: 8,
        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.55)',
        fontSize: 12, lineHeight: 17,
      }}>
        People you add can see your stories marked "Close Friends". They won't get notified that they're on or off the list.
      </Text>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={isDark ? '#fff' : '#000'} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Ionicons name="people-outline" size={42} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', marginTop: 12, textAlign: 'center' }}>
            {query
              ? 'No matches.'
              : 'Follow people first to add them to your close-friends list.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {filtered.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => toggle(u)}
              disabled={pendingIds.has(u.id)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 18, paddingVertical: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {u.avatar ? (
                  <Image source={{ uri: u.avatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: '700' }}>
                    {(u.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={{
                flex: 1, marginLeft: 12,
                color: isDark ? '#fff' : '#000',
                fontWeight: '700', fontSize: 15,
              }} numberOfLines={1}>
                {u.name}
              </Text>
              <View style={{
                width: 26, height: 26, borderRadius: 13,
                borderWidth: 2,
                borderColor: u.is_close ? '#22c55e' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
                backgroundColor: u.is_close ? '#22c55e' : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {u.is_close ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
