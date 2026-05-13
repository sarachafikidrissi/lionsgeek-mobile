import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAppContext } from '@/context';
import API from '@/api';
import OverlayRenderer from '@/components/stories/OverlayRenderer';
import useStoryMusic from '@/components/stories/useStoryMusic';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const TOP_INSET = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;
const TAP_ZONE_WIDTH = WINDOW_W * 0.30;
const SWIPE_DOWN_THRESHOLD = 120;

/**
 * Full-screen viewer for a single highlight's stories.
 *
 * Same gesture / progress-bar model as the regular story viewer, but without
 * reactions/replies/user-jumping. The owner can long-press to remove a
 * specific item from the highlight.
 */
export default function HighlightViewerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { token, user } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [musicPaused, setMusicPaused] = useState(false);

  const videoRef = useRef(null);
  const progress = useSharedValue(0);
  const isPausedRef = useRef(false);
  const animatingExitRef = useRef(false);
  const translateY = useSharedValue(0);

  const stories = highlight?.stories || [];
  const currentStory = stories[storyIdx] || null;
  const isOwner = !!(highlight && user && highlight.user_id === user.id);
  const musicOverlay = (currentStory?.overlays || []).find((o) => o.type === 'music') || null;

  useStoryMusic(musicOverlay, { isPaused: musicPaused });

  // Load highlight
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || !token) return;
      try {
        const data = await API.getHighlight(id, token);
        if (cancelled) return;
        setHighlight(data?.highlight || null);
      } catch (e) {
        if (cancelled) return;
        setHighlight(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, token]);

  const advance = useCallback(() => {
    setStoryIdx((idx) => {
      if (idx + 1 < stories.length) return idx + 1;
      doClose();
      return idx;
    });
  }, [stories.length]);

  const restartProgress = useCallback(() => {
    if (!currentStory) return;
    cancelAnimation(progress);
    progress.value = 0;
    setVideoReady(false);
    const duration = Math.max(1500, currentStory.duration_ms || 5000);
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advance)();
    });
  }, [currentStory, advance]);

  useEffect(() => {
    restartProgress();
    return () => cancelAnimation(progress);
  }, [restartProgress]);

  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setMusicPaused(true);
    cancelAnimation(progress);
    if (videoRef.current) videoRef.current.pauseAsync?.().catch(() => {});
  }, []);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setMusicPaused(false);
    if (!currentStory) return;
    const remaining = Math.max(0, 1 - progress.value);
    const duration = Math.max(500, Math.round((currentStory.duration_ms || 5000) * remaining));
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    if (videoRef.current) videoRef.current.playAsync?.().catch(() => {});
  }, [currentStory, advance]);

  const goPrev = useCallback(() => {
    setStoryIdx((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);
  const goNext = useCallback(() => advance(), [advance]);

  const doClose = useCallback(() => {
    if (animatingExitRef.current) return;
    animatingExitRef.current = true;
    cancelAnimation(progress);
    translateY.value = withTiming(WINDOW_H, { duration: 220 }, (finished) => {
      if (finished) runOnJS(router.back)();
    });
  }, [router]);

  const tapGesture = Gesture.Tap()
    .maxDuration(220)
    .onEnd((e) => {
      if (e.x < TAP_ZONE_WIDTH) runOnJS(goPrev)();
      else runOnJS(goNext)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => { runOnJS(pause)(); })
    .onEnd(() => { runOnJS(resume)(); })
    .onTouchesUp(() => { runOnJS(resume)(); });

  const panGesture = Gesture.Pan()
    .activeOffsetY(15)
    .failOffsetY(-15)
    .onStart(() => { runOnJS(pause)(); })
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_DOWN_THRESHOLD || e.velocityY > 800) {
        runOnJS(doClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        runOnJS(resume)();
      }
    });

  const composed = Gesture.Simultaneous(panGesture, Gesture.Exclusive(longPressGesture, tapGesture));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - Math.min(translateY.value / 400, 0.6),
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const handleRemove = useCallback(() => {
    if (!isOwner || !currentStory || !highlight) return;
    pause();
    Alert.alert(
      'Remove from highlight?',
      'This will only remove it from this highlight.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await API.removeStoryFromHighlight(highlight.id, currentStory.id, token);
              // If the highlight is now empty, the server deletes it for us.
              if (res?.deleted) {
                doClose();
                return;
              }
              const newStories = stories.filter((s) => s.id !== currentStory.id);
              if (newStories.length === 0) {
                doClose();
                return;
              }
              setHighlight((prev) => prev ? { ...prev, stories: newStories } : prev);
              setStoryIdx((i) => Math.min(i, newStories.length - 1));
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not remove.');
              resume();
            }
          },
        },
      ],
    );
  }, [isOwner, currentStory, highlight, stories, token, pause, resume, doClose]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!highlight || stories.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Ionicons name="albums-outline" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>
          This highlight is empty.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#ffc801' }}
        >
          <Text style={{ color: '#000', fontWeight: '800' }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" hidden={false} />
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, containerStyle]}>
          {/* Media layer */}
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            {currentStory.media_type === 'video' ? (
              <Video
                key={currentStory.id}
                ref={videoRef}
                source={{ uri: currentStory.media_url }}
                style={{ width: WINDOW_W, height: WINDOW_H }}
                resizeMode={ResizeMode.COVER}
                shouldPlay={!isPausedRef.current}
                isMuted={muted || !!musicOverlay}
                useNativeControls={false}
                onLoad={() => setVideoReady(true)}
                onError={() => setVideoReady(true)}
                onPlaybackStatusUpdate={(s) => { if (s?.didJustFinish) advance(); }}
              />
            ) : (
              <Image
                key={currentStory.id}
                source={{ uri: currentStory.media_url }}
                style={{ width: WINDOW_W, height: WINDOW_H }}
                resizeMode="cover"
              />
            )}

            {currentStory.media_type === 'video' && !videoReady ? (
              <ActivityIndicator size="large" color="#fff" style={{ position: 'absolute' }} />
            ) : null}

            <OverlayRenderer
              overlays={currentStory.overlays}
              musicAnimated={!musicPaused}
              onMentionPress={(o) => {
                if (!o?.user_id) return;
                pause();
                doClose();
                setTimeout(() => router.push(`/(tabs)/profile?userId=${o.user_id}`), 240);
              }}
            />
          </View>

          {/* Top overlay */}
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: TOP_INSET, paddingHorizontal: 10 }}
          >
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4 }}>
              {stories.map((_, i) => {
                const isPast = i < storyIdx;
                const isCurrent = i === storyIdx;
                return (
                  <View
                    key={i}
                    style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}
                  >
                    {isPast ? (
                      <View style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                    ) : isCurrent ? (
                      <Animated.View style={[{ height: '100%', backgroundColor: '#fff' }, progressFillStyle]} />
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 6 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
              }}>
                {highlight.cover_url ? (
                  <Image source={{ uri: highlight.cover_url }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Ionicons name="albums" size={16} color="rgba(255,255,255,0.7)" />
                )}
              </View>
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                {highlight.title}
              </Text>

              <View style={{ flex: 1 }} />

              {currentStory.media_type === 'video' ? (
                <Pressable
                  onPress={() => setMuted((m) => !m)}
                  hitSlop={10}
                  style={topBtn}
                >
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                </Pressable>
              ) : null}

              {isOwner ? (
                <Pressable onPress={handleRemove} hitSlop={10} style={[topBtn, { marginLeft: 6 }]}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              ) : null}

              <Pressable onPress={doClose} hitSlop={10} style={[topBtn, { marginLeft: 6 }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const topBtn = {
  width: 36, height: 36, borderRadius: 18,
  backgroundColor: 'rgba(0,0,0,0.35)',
  alignItems: 'center', justifyContent: 'center',
};
