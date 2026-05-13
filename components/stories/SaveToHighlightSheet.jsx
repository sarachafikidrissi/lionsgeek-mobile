import { useEffect, useState, useCallback } from 'react';
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
  Alert,
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
import API from '@/api';

const { height: WINDOW_H } = Dimensions.get('window');
const SHEET_H = Math.round(WINDOW_H * 0.6);

/**
 * Bottom sheet that lets a user add a story to a highlight.
 *
 * Two modes:
 *   1) Pick an existing highlight (tile grid)
 *   2) Create new (tap "+ New" → enter title)
 *
 * Props:
 *   visible    – open/close trigger
 *   storyId    – the story to save
 *   ownerId    – user id (= auth user) whose highlights we list
 *   onClose    – close callback
 *   onSaved    – called after a successful save with the resulting highlight
 */
export default function SaveToHighlightSheet({ visible, storyId, ownerId, onClose, onSaved }) {
  const { token } = useAppContext();
  const translateY = useSharedValue(SHEET_H);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [mode, setMode] = useState('pick'); // 'pick' | 'create'
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(SHEET_H, { duration: 220 });
      setMode('pick');
      setNewTitle('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !ownerId || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await API.listHighlights(ownerId, token);
        if (cancelled) return;
        setHighlights(Array.isArray(data?.highlights) ? data.highlights : []);
      } catch (e) {
        if (!cancelled) setHighlights([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, ownerId, token]);

  const dismiss = useCallback(() => {
    onClose && onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(15)
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
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

  const handlePickExisting = useCallback(async (highlight) => {
    if (!storyId || !token || saving) return;
    setSaving(true);
    try {
      const data = await API.addStoryToHighlight(highlight.id, storyId, token);
      onSaved && onSaved(data?.highlight || highlight);
      dismiss();
    } catch (e) {
      Alert.alert('Could not save', e?.response?.data?.message || e?.message || 'Try again later.');
    } finally {
      setSaving(false);
    }
  }, [storyId, token, saving, onSaved, dismiss]);

  const handleCreate = useCallback(async () => {
    const title = newTitle.trim();
    if (!title) {
      Alert.alert('Title required', 'Please give this highlight a name.');
      return;
    }
    if (!storyId || !token || saving) return;
    setSaving(true);
    try {
      const data = await API.createHighlight({ title, storyId }, token);
      onSaved && onSaved(data?.highlight);
      dismiss();
    } catch (e) {
      Alert.alert('Could not create', e?.response?.data?.message || e?.message || 'Try again later.');
    } finally {
      setSaving(false);
    }
  }, [newTitle, storyId, token, saving, onSaved, dismiss]);

  if (!visible && translateY.value === SHEET_H) return null;

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={dismiss} style={{ position: 'absolute', inset: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      <GestureHandlerRootView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                height: SHEET_H,
                backgroundColor: '#121212',
                borderTopLeftRadius: 22,
                borderTopRightRadius: 22,
                overflow: 'hidden',
              },
              sheetStyle,
            ]}
          >
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 18, paddingTop: 6, paddingBottom: 12,
              borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
            }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {mode === 'pick' ? 'Save to highlight' : 'New highlight'}
              </Text>
              <Pressable onPress={dismiss} hitSlop={10}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            {mode === 'pick' ? (
              loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={{ paddingVertical: 14, paddingHorizontal: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 22 }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                    {/* "New highlight" tile */}
                    <Pressable
                      onPress={() => setMode('create')}
                      style={({ pressed }) => [tileStyle, { opacity: pressed ? 0.7 : 1, backgroundColor: 'rgba(255,255,255,0.08)' }]}
                    >
                      <Ionicons name="add" size={32} color="#ffc801" />
                      <Text style={{ color: '#fff', fontWeight: '700', marginTop: 8 }} numberOfLines={1}>
                        New
                      </Text>
                    </Pressable>

                    {highlights.map((h) => (
                      <Pressable
                        key={h.id}
                        onPress={() => handlePickExisting(h)}
                        disabled={saving}
                        style={({ pressed }) => [tileStyle, { opacity: pressed || saving ? 0.65 : 1 }]}
                      >
                        {h.cover_url ? (
                          <Image source={{ uri: h.cover_url }} style={{ position: 'absolute', inset: 0 }} />
                        ) : (
                          <View style={{
                            position: 'absolute', inset: 0,
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Ionicons name="albums-outline" size={28} color="rgba(255,255,255,0.4)" />
                          </View>
                        )}
                        <View style={{
                          position: 'absolute', left: 0, right: 0, bottom: 0,
                          paddingVertical: 6, paddingHorizontal: 8,
                          backgroundColor: 'rgba(0,0,0,0.55)',
                        }}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
                            {h.title}
                          </Text>
                          <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>
                            {h.stories_count} {h.stories_count === 1 ? 'item' : 'items'}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>

                  {highlights.length === 0 && !loading ? (
                    <Text style={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 24 }}>
                      No highlights yet. Tap "New" to create your first one.
                    </Text>
                  ) : null}
                </ScrollView>
              )
            ) : (
              <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 22 }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 }}>
                  Highlight name
                </Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Travel, Work, 2026…"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  maxLength={80}
                  autoFocus
                  style={{
                    color: '#fff', fontSize: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    paddingHorizontal: 14,
                    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
                    borderRadius: 12,
                  }}
                />

                <View style={{ flex: 1 }} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => setMode('pick')}
                    style={({ pressed }) => [{
                      flex: 1, height: 48, borderRadius: 12,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: pressed ? 0.7 : 1,
                    }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreate}
                    disabled={saving || !newTitle.trim()}
                    style={({ pressed }) => [{
                      flex: 1, height: 48, borderRadius: 12,
                      backgroundColor: newTitle.trim() ? '#ffc801' : 'rgba(255,255,255,0.12)',
                      alignItems: 'center', justifyContent: 'center',
                      opacity: pressed ? 0.85 : 1,
                    }]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={{
                        color: newTitle.trim() ? '#000' : 'rgba(255,255,255,0.45)',
                        fontWeight: '800',
                      }}>
                        Create
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {saving && mode === 'pick' ? (
              <View style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}

const tileStyle = {
  width: 100,
  height: 130,
  borderRadius: 12,
  overflow: 'hidden',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
};
