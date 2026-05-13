import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { resolveAvatarUrl } from '@/components/helpers/helpers';
import API from '@/api';

const { height: WINDOW_H } = Dimensions.get('window');
const SHEET_H = Math.round(WINDOW_H * 0.7);

/**
 * Bottom sheet that lets the user pick someone to mention in a story.
 *
 * Props:
 *   visible
 *   onClose
 *   onPick(user)   → { id, name, avatar }
 */
export default function UserPickerSheet({ visible, onClose, onPick }) {
  const { token } = useAppContext();
  const translateY = useSharedValue(SHEET_H);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
      setTimeout(() => inputRef.current?.focus?.(), 200);
    } else {
      translateY.value = withTiming(SHEET_H, { duration: 200 });
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  // Debounced search
  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await API.searchUsers(q, token);
        if (cancelled) return;
        const users = Array.isArray(data?.results)
          ? data.results.filter((r) => r?.type === 'user' || !r?.type)
          : [];
        setResults(users);
      } catch (_) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, token, visible]);

  const dismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose && onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(15)
    .onUpdate((e) => { if (e.translationY > 0) translateY.value = e.translationY; })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 700) {
        translateY.value = withTiming(SHEET_H, { duration: 200 }, (f) => {
          if (f) runOnJS(dismiss)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 180 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.value / SHEET_H) * 0.55,
  }));

  if (!visible && translateY.value === SHEET_H) return null;

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={dismiss} style={{ position: 'absolute', inset: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      <GestureHandlerRootView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[{
            height: SHEET_H,
            backgroundColor: '#0d0d0d',
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            overflow: 'hidden',
          }, sheetStyle]}>
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 6 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 18, paddingBottom: 10,
            }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Mention someone</Text>
              <Pressable onPress={dismiss} hitSlop={10}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            <View style={{
              marginHorizontal: 14, marginBottom: 8,
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingHorizontal: 12,
              paddingVertical: Platform.OS === 'ios' ? 10 : 4,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.6)" />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name…"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 0 }}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {loading ? <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" /> : null}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 30 : 18 }}
            >
              {!query.trim() ? (
                <View style={{ paddingHorizontal: 20, paddingTop: 24, alignItems: 'center' }}>
                  <Ionicons name="at-circle-outline" size={36} color="rgba(255,255,255,0.4)" />
                  <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8, textAlign: 'center', fontSize: 13 }}>
                    Type a name to find someone to mention.
                  </Text>
                </View>
              ) : !loading && results.length === 0 ? (
                <View style={{ paddingHorizontal: 20, paddingTop: 30, alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)' }}>No matches.</Text>
                </View>
              ) : (
                results.map((u) => {
                  const avatar = resolveAvatarUrl(u.avatar || u.image);
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => { onPick?.(u); }}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, paddingVertical: 9,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{
                        width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {(u.name || 'U').charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                          {u.name}
                        </Text>
                        {u.promo || u.field ? (
                          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                            {[u.field, u.promo].filter(Boolean).join(' • ')}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}
