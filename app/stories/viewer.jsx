import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { resolveAvatarUrl } from '@/components/helpers/helpers';
import API from '@/api';
import ViewerListSheet from '@/components/stories/ViewerListSheet';
import EmojiReactionRow from '@/components/stories/EmojiReactionRow';
import StoryReplyInput from '@/components/stories/StoryReplyInput';
import SaveToHighlightSheet from '@/components/stories/SaveToHighlightSheet';
import OverlayRenderer from '@/components/stories/OverlayRenderer';
import useStoryMusic from '@/components/stories/useStoryMusic';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const TOP_INSET = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;
const TAP_ZONE_WIDTH = WINDOW_W * 0.30; // left/right tap zones
const SWIPE_DOWN_THRESHOLD = 120;

/**
 * Premium-feel story viewer.
 *
 * Gestures (all snappy & Reanimated-driven):
 *   - tap left  → previous story
 *   - tap right → next story
 *   - press+hold (anywhere) → pause progress + pause video
 *   - swipe down → close viewer (translated card slides down)
 *
 * Behaviours:
 *   - per-story progress bars at the top, auto-advancing
 *   - auto-advances to the next user when reaching the last story
 *   - auto-closes when reaching the last story of the last user
 *   - records "view" on the backend the moment a story is shown
 *   - mute toggle for video stories
 *   - delete button on own stories
 *
 * Data:
 *   Fetches /api/mobile/stories itself (so we get fresh viewed flags) and
 *   jumps to `startUserId`'s group as the initial slide.
 */
export default function StoryViewerScreen() {
  const router = useRouter();
  const { startUserId } = useLocalSearchParams();
  const { token, user } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [userIdx, setUserIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [viewerSheetOpen, setViewerSheetOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  // Reactive paused flag for the music hook (kept in sync with isPausedRef).
  const [musicPaused, setMusicPaused] = useState(false);
  // Local override for reaction & counts so the UI feels instant when the
  // user taps an emoji; the server response then confirms / corrects.
  const [reactionOverride, setReactionOverride] = useState({}); // { [storyId]: emoji }
  const [reactionCountOverride, setReactionCountOverride] = useState({}); // { [storyId]: count }

  const videoRef = useRef(null);
  const progress = useSharedValue(0); // 0..1 for the current story
  const isPausedRef = useRef(false);
  const lastTickRef = useRef(0);
  const animatingExitRef = useRef(false);
  const sentViewIds = useRef(new Set());

  // Animated translateY for swipe-down dismiss.
  const translateY = useSharedValue(0);

  const currentGroup = groups[userIdx] || null;
  const currentStory = currentGroup?.stories?.[storyIdx] || null;
  const totalStoriesInGroup = currentGroup?.stories?.length || 0;
  const musicOverlay = (currentStory?.overlays || []).find((o) => o.type === 'music') || null;

  // Play the story's music sticker (if any). Looped to its trim window and
  // tied to the story's pause state. Hook handles null overlays gracefully.
  useStoryMusic(musicOverlay, { isPaused: musicPaused });

  // ────────────────────────────────────────────────────────────────────
  // Load stories
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const data = await API.listStories(token);
        if (cancelled) return;
        const g = Array.isArray(data?.groups) ? data.groups : [];
        setGroups(g);
        if (startUserId != null) {
          const idx = g.findIndex((x) => String(x.user?.id) === String(startUserId));
          if (idx >= 0) setUserIdx(idx);
        }
      } catch (e) {
        console.warn('[viewer] load failed', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, startUserId]);

  // ────────────────────────────────────────────────────────────────────
  // View tracking (record once per story)
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentStory || !token) return;
    const id = currentStory.id;
    if (sentViewIds.current.has(id)) return;
    sentViewIds.current.add(id);
    API.viewStory(id, token).catch(() => {});
  }, [currentStory, token]);

  // ────────────────────────────────────────────────────────────────────
  // Progress animation
  // ────────────────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    setStoryIdx((idx) => {
      const total = groups[userIdx]?.stories?.length || 0;
      if (idx + 1 < total) {
        return idx + 1;
      }
      // last story of this user – jump to next user
      const nextUser = userIdx + 1;
      if (nextUser < groups.length) {
        setUserIdx(nextUser);
        return 0;
      }
      // last of last → close
      doClose();
      return idx;
    });
  }, [groups, userIdx]);

  const restartProgress = useCallback(() => {
    if (!currentStory) return;
    cancelAnimation(progress);
    progress.value = 0;
    setVideoReady(false);
    const duration = Math.max(1500, currentStory.duration_ms || 5000);
    progress.value = withTiming(1, {
      duration,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) runOnJS(advance)();
    });
  }, [currentStory, advance]);

  // Trigger / restart progress whenever the active story changes
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
    progress.value = withTiming(1, {
      duration,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    if (videoRef.current) videoRef.current.playAsync?.().catch(() => {});
  }, [currentStory, advance]);

  // ────────────────────────────────────────────────────────────────────
  // Navigation helpers
  // ────────────────────────────────────────────────────────────────────
  const goPrev = useCallback(() => {
    setStoryIdx((idx) => {
      if (idx > 0) return idx - 1;
      // beginning of this user – jump back to previous user (last story)
      setUserIdx((u) => {
        if (u > 0) {
          const prevIdx = u - 1;
          const t = groups[prevIdx]?.stories?.length || 1;
          // schedule storyIdx after userIdx update
          setTimeout(() => setStoryIdx(t - 1), 0);
          return prevIdx;
        }
        return u;
      });
      return idx;
    });
  }, [groups]);

  const goNext = useCallback(() => advance(), [advance]);

  const doClose = useCallback(() => {
    if (animatingExitRef.current) return;
    animatingExitRef.current = true;
    cancelAnimation(progress);
    translateY.value = withTiming(WINDOW_H, { duration: 220 }, (finished) => {
      if (finished) runOnJS(router.back)();
    });
  }, [router]);

  // ────────────────────────────────────────────────────────────────────
  // Gestures
  // ────────────────────────────────────────────────────────────────────
  const tapGesture = Gesture.Tap()
    .maxDuration(220)
    .onEnd((e) => {
      if (e.x < TAP_ZONE_WIDTH) {
        runOnJS(goPrev)();
      } else {
        runOnJS(goNext)();
      }
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

  // ────────────────────────────────────────────────────────────────────
  // Animated styles
  // ────────────────────────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - Math.min(translateY.value / 400, 0.6),
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // ────────────────────────────────────────────────────────────────────
  // Reactions (not own stories)
  // ────────────────────────────────────────────────────────────────────
  const handleReact = useCallback(async (emoji) => {
    if (!currentStory || currentStory.is_mine || !token) return;
    const storyId = currentStory.id;
    const previous = reactionOverride[storyId] ?? currentStory.my_reaction ?? null;
    const previousCount = reactionCountOverride[storyId] ?? currentStory.reactions_count ?? 0;
    // Optimistic toggle behaviour: tapping the same emoji again removes it.
    const sameAsBefore = previous === emoji;
    const nextEmoji = sameAsBefore ? null : emoji;
    const nextCount = sameAsBefore
      ? Math.max(0, previousCount - 1)
      : (previous ? previousCount : previousCount + 1);

    setReactionOverride((m) => ({ ...m, [storyId]: nextEmoji }));
    setReactionCountOverride((m) => ({ ...m, [storyId]: nextCount }));

    try {
      if (sameAsBefore) {
        await API.removeStoryReaction(storyId, token);
      } else {
        await API.reactToStory(storyId, emoji, token);
      }
    } catch (e) {
      // Revert on failure.
      setReactionOverride((m) => ({ ...m, [storyId]: previous }));
      setReactionCountOverride((m) => ({ ...m, [storyId]: previousCount }));
    }
  }, [currentStory, token, reactionOverride, reactionCountOverride]);

  // ────────────────────────────────────────────────────────────────────
  // Reply (not own stories) – sends a chat message
  // ────────────────────────────────────────────────────────────────────
  const handleReply = useCallback(async (text) => {
    if (!currentStory || currentStory.is_mine || !token) return;
    await API.replyToStory(currentStory.id, text, token);
  }, [currentStory, token]);

  const onReplyFocus = useCallback(() => {
    setReplying(true);
    pause();
  }, [pause]);

  const onReplyBlur = useCallback(() => {
    setReplying(false);
    resume();
  }, [resume]);

  // ────────────────────────────────────────────────────────────────────
  // Delete (own stories only)
  // ────────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!currentStory || !currentStory.is_mine) return;
    pause();
    Alert.alert(
      'Delete story?',
      'This will remove the story for everyone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await API.deleteStory(currentStory.id, token);
              // Remove locally and advance / close
              const newGroups = groups.map((g, gi) => {
                if (gi !== userIdx) return g;
                return { ...g, stories: g.stories.filter((s) => s.id !== currentStory.id) };
              }).filter((g) => g.stories.length > 0);
              if (newGroups.length === 0) {
                doClose();
                return;
              }
              setGroups(newGroups);
              setUserIdx((u) => Math.min(u, newGroups.length - 1));
              setStoryIdx(0);
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not delete.');
            }
          },
        },
      ],
    );
  };

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!currentStory) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>
          No stories to show right now.
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

  const ownerAvatar = resolveAvatarUrl(currentGroup?.user?.avatar);
  const isMine = !!currentStory.is_mine;
  // Auto-mute the underlying video when a music overlay is playing.
  const videoIsMuted = muted || !!musicOverlay;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" hidden={false} />
      {/*
        Gestures (tap prev/next, long-press pause, swipe-down close) are
        attached ONLY to the media layer. Header, reactions and reply sit in
        a sibling overlay so their touches never trigger story navigation.
      */}
      <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, containerStyle]}>
        <GestureDetector gesture={composed}>
          <View style={{ flex: 1 }}>
            {/* Media layer — sole target for tap / pan / long-press */}
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              {currentStory.media_type === 'video' ? (
                <Video
                  key={currentStory.id}
                  ref={videoRef}
                  source={{ uri: currentStory.media_url }}
                  style={{ width: WINDOW_W, height: WINDOW_H }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={!isPausedRef.current}
                  isMuted={videoIsMuted}
                  useNativeControls={false}
                  onLoad={() => setVideoReady(true)}
                  onError={() => setVideoReady(true)}
                  onPlaybackStatusUpdate={(status) => {
                    if (status?.didJustFinish) advance();
                  }}
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
                <ActivityIndicator
                  size="large"
                  color="#fff"
                  style={{ position: 'absolute' }}
                />
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
          </View>
        </GestureDetector>

        {/* Chrome above the gesture layer — receives taps before navigation */}
        <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          {/* Top overlay: progress bars + header */}
          <View
            pointerEvents="box-none"
            style={{
              paddingTop: TOP_INSET,
              paddingHorizontal: 10,
            }}
          >
            {/* Progress bars */}
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4 }}>
              {currentGroup.stories.map((_, i) => {
                const isPast = i < storyIdx;
                const isCurrent = i === storyIdx;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1, height: 2.5, borderRadius: 2,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      overflow: 'hidden',
                    }}
                  >
                    {isPast ? (
                      <View style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                    ) : isCurrent ? (
                      <Animated.View
                        style={[{ height: '100%', backgroundColor: '#fff' }, progressFillStyle]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: 12, paddingHorizontal: 6,
            }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {ownerAvatar ? (
                  <Image source={{ uri: ownerAvatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {(currentGroup.user?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                {isMine ? 'Your story' : currentGroup.user?.name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', marginLeft: 8, fontSize: 12 }}>
                {timeAgo(currentStory.created_at)}
              </Text>

              {currentStory.audience === 'close_friends' ? (
                <View style={{
                  marginLeft: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 7, paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: 'rgba(34,197,94,0.85)',
                }}>
                  <Ionicons name="star" size={10} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                    Close
                  </Text>
                </View>
              ) : null}

              <View style={{ flex: 1 }} />

              {currentStory.media_type === 'video' || !!musicOverlay ? (
                <Pressable
                  onPress={() => setMuted((m) => !m)}
                  hitSlop={10}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 6,
                  }}
                >
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={doClose}
                hitSlop={10}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Bottom: viewers / delete for own stories */}
          {isMine ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute', bottom: 30, left: 0, right: 0,
                paddingHorizontal: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Pressable
                onPress={() => setViewerSheetOpen(true)}
                hitSlop={6}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                }]}
              >
                <Ionicons name="eye-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {currentStory.views_count ?? 0}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 4 }}>
                  Viewers
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => { pause(); setSaveSheetOpen(true); }}
                  hitSlop={10}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="bookmark-outline" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  hitSlop={10}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          ) : (
            // Engagement strip for other people's stories (reply + reactions)
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                paddingBottom: Platform.OS === 'ios' ? 28 : 18,
              }}
            >
              <EmojiReactionRow
                currentReaction={
                  reactionOverride[currentStory.id] !== undefined
                    ? reactionOverride[currentStory.id]
                    : currentStory.my_reaction
                }
                onReact={handleReact}
              />
              <View style={{ height: 8 }} />
              <StoryReplyInput
                ownerName={currentGroup.user?.name?.split(' ')?.[0]}
                onSubmit={handleReply}
                onFocus={onReplyFocus}
                onBlur={onReplyBlur}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Viewer sheet (own stories) */}
      <ViewerListSheet
        visible={viewerSheetOpen}
        storyId={isMine ? currentStory?.id : null}
        onClose={() => setViewerSheetOpen(false)}
        onPause={pause}
        onResume={resume}
      />

      {/* Save-to-Highlight sheet (own stories) */}
      <SaveToHighlightSheet
        visible={saveSheetOpen}
        storyId={isMine ? currentStory?.id : null}
        ownerId={user?.id}
        onClose={() => { setSaveSheetOpen(false); resume(); }}
        onSaved={() => { setSaveSheetOpen(false); resume(); }}
      />
    </GestureHandlerRootView>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
