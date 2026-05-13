import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
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
 * Bottom sheet listing the viewers of a single story.
 *
 * Props:
 *   visible    – when true, animate up; when false, animate down
 *   storyId    – which story to fetch viewers for
 *   onClose    – called when the user dismisses
 *   onPause/onResume – optional hooks so the parent viewer can pause the
 *                       story progress while the sheet is open.
 */
export default function ViewerListSheet({ visible, storyId, onClose, onPause, onResume }) {
  const { token } = useAppContext();
  const translateY = useSharedValue(SHEET_H);
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reactionsCount, setReactionsCount] = useState(0);

  // Open/close animation
  useEffect(() => {
    if (visible) {
      onPause && onPause();
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(SHEET_H, { duration: 220, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, onPause]);

  // Fetch viewers when opened with a story id
  useEffect(() => {
    if (!visible || !storyId || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await API.getStoryViewers(storyId, token);
        if (cancelled) return;
        setViewers(Array.isArray(data?.viewers) ? data.viewers : []);
        setReactionsCount(Number(data?.reactions_count || 0));
      } catch (e) {
        if (cancelled) return;
        setViewers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, storyId, token]);

  const dismiss = useCallback(() => {
    onResume && onResume();
    onClose && onClose();
  }, [onResume, onClose]);

  // Drag-down to dismiss
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

  if (!visible && translateY.value === SHEET_H) return null;

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Backdrop */}
      <Pressable onPress={dismiss} style={{ position: 'absolute', inset: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      <GestureHandlerRootView style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                height: SHEET_H,
                backgroundColor: '#111',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                overflow: 'hidden',
              },
              sheetStyle,
            ]}
          >
            {/* Grab handle */}
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 6 }}>
              <View style={{
                width: 38, height: 4, borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.25)',
              }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14,
              borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="eye-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{viewers.length}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Ionicons name="heart-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{reactionsCount}</Text>
                </View>
              </View>
              <Pressable onPress={dismiss} hitSlop={10}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            {/* Body */}
            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : viewers.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
                <Ionicons name="eye-off-outline" size={36} color="rgba(255,255,255,0.45)" />
                <Text style={{ color: 'rgba(255,255,255,0.65)', marginTop: 12, textAlign: 'center' }}>
                  No one has viewed this story yet.
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 34 : 24 }}
              >
                {viewers.map((v) => (
                  <ViewerRow key={v.id} viewer={v} />
                ))}
              </ScrollView>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}

function ViewerRow({ viewer }) {
  const avatar = resolveAvatarUrl(viewer.avatar);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10, paddingHorizontal: 6,
    }}>
      <View style={{
        width: 42, height: 42, borderRadius: 21, overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {(viewer.name || 'U').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
          {viewer.name || 'Unknown'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
          {timeAgo(viewer.viewed_at)}
        </Text>
      </View>
      {viewer.reaction ? (
        <Text style={{ fontSize: 22, marginLeft: 8 }}>{viewer.reaction}</Text>
      ) : null}
    </View>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
