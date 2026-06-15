import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Alert,
  StyleSheet,
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
import { Audio } from 'expo-av';
import { useAppContext } from '@/context';
import API from '@/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PREVIEW_MAX_MS,
  STORY_MAX_MS,
  CATEGORY_SECTIONS,
  getClipDurationMs,
  getPreviewPlayableMs,
  getMaxStartMs,
  buildMusicOverlayPayload,
  formatDuration,
  formatMs,
} from '@/components/stories/editor/musicUtils';

const { height: WINDOW_H } = Dimensions.get('window');
const SHEET_H = Math.round(WINDOW_H * 0.82);

const DISPLAY_STYLES = [
  { id: 'none',    label: 'Sound only', icon: 'headset' },
  { id: 'pill',    label: 'Pill',       icon: 'radio-button-on' },
  { id: 'card',    label: 'Card',       icon: 'square' },
  { id: 'minimal', label: 'Minimal',    icon: 'remove' },
];

const CATEGORIES = [
  { id: 'trending', label: 'Tendance' },
  { id: 'for_you',  label: 'Top Maroc' },
  { id: 'original', label: 'Original' },
  { id: 'saved',    label: 'Saved' },
];

/**
 * Story music picker — GET /mobile/music/browse (Morocco charts & trending).
 */
export default function MusicPickerSheet({ visible, onClose, onPick }) {
  const { token } = useAppContext();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SHEET_H);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('trending');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null); // 'spotify+itunes' | 'itunes'
  const [savedTracks, setSavedTracks] = useState([]);
  const [sectionTitle, setSectionTitle] = useState('Tendance au Maroc');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [startMs, setStartMs] = useState(0);
  const [display, setDisplay] = useState('none');
  const [playing, setPlaying] = useState(false);
  const inputRef = useRef(null);
  const soundRef = useRef(null);
  const positionTimerRef = useRef(null);
  const [audioPos, setAudioPos] = useState(0); // ms within preview

  // ─── Show / hide animation ─────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(SHEET_H, { duration: 200 });
      // Reset state once the sheet fully leaves the screen
      setTimeout(() => {
        setQuery('');
        setCategory('trending');
        setResults([]);
        setSelected(null);
        setStartMs(0);
        setDisplay('none');
        setFeaturedIndex(0);
        setSectionTitle('Tendance au Maroc');
      }, 220);
    }
  }, [visible]);

  // ─── Audio session ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (_) {}
    })();
    return () => unloadAudio();
  }, []);

  const unloadAudio = useCallback(async () => {
    if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current);
      positionTimerRef.current = null;
    }
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch (_) {}
      try { await soundRef.current.unloadAsync(); } catch (_) {}
      soundRef.current = null;
    }
    setPlaying(false);
    setAudioPos(0);
  }, []);

  // Stop audio when the sheet closes.
  useEffect(() => {
    if (!visible) unloadAudio();
  }, [visible, unloadAudio]);

  const toggleSaved = useCallback((track) => {
    if (!track?.id) return;
    setSavedTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      if (exists) return prev.filter((t) => t.id !== track.id);
      return [track, ...prev];
    });
  }, []);

  const isTrackSaved = useCallback(
    (track) => savedTracks.some((t) => t.id === track?.id),
    [savedTracks],
  );

  // ─── Load tracks via unified browse API ────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    if (category === 'saved' && !query.trim()) {
      setResults(savedTracks);
      setSectionTitle('Saved');
      setLoading(false);
      return;
    }

    const section = query.trim()
      ? 'search'
      : (CATEGORY_SECTIONS[category] || 'top_morocco');

    if (section === 'saved') return;

    let cancelled = false;
    setLoading(true);
    const delay = query.trim() ? 350 : 0;
    const t = setTimeout(async () => {
      try {
        const data = await API.browseMusic(token, {
          section,
          country: 'MA',
          q: query.trim(),
          limit: 50,
        });
        if (cancelled) return;
        setSectionTitle(data?.title || 'Tendance au Maroc');
        setSource(data?.source || null);
        setResults(Array.isArray(data?.items) ? data.items : []);
        setFeaturedIndex(0);
      } catch (_) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => { cancelled = true; clearTimeout(t); };
  }, [query, category, token, visible, savedTracks]);

  // ─── Track selection + playback ────────────────────────────────────────
  const playTrack = useCallback(async (track) => {
    await unloadAudio();
    if (!track?.preview_url) {
      setPlaying(false);
      return;
    }
    try {
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: track.preview_url },
        {
          shouldPlay: true,
          isLooping: true,
          positionMillis: 0,
          volume: 1.0,
        }
      );
      soundRef.current = sound;
      setPlaying(true);
      // Poll position for the playhead overlay on the waveform.
      positionTimerRef.current = setInterval(async () => {
        try {
          const s = await sound.getStatusAsync();
          if (s?.isLoaded) setAudioPos(s.positionMillis || 0);
        } catch (_) {}
      }, 150);
    } catch (e) {
      Alert.alert('Playback error', e?.message || 'Could not play preview.');
      setPlaying(false);
    }
  }, [unloadAudio]);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) {
      if (selected) await playTrack(selected);
      return;
    }
    try {
      const status = await soundRef.current.getStatusAsync();
      if (status?.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch (_) {}
  }, [selected, playTrack]);

  const handleSelectTrack = useCallback(async (track) => {
    setSelected(track);
    setStartMs(0);
    setDisplay('none');
    await playTrack(track);
  }, [playTrack]);

  const clipDurationMs = selected ? getClipDurationMs(selected) : STORY_MAX_MS;
  const previewPlayableMs = selected ? getPreviewPlayableMs(selected) : PREVIEW_MAX_MS;
  const maxStartMs = selected ? getMaxStartMs(selected) : 0;
  const trimWindowFraction = clipDurationMs > 0
    ? Math.min(1, previewPlayableMs / clipDurationMs)
    : 1;

  // ─── Trim slider ───────────────────────────────────────────────────────
  const trackBarRef = useRef({ width: 0, x: 0 });
  const onTrackBarLayout = useCallback((e) => {
    const { width, x } = e.nativeEvent.layout;
    trackBarRef.current = { width, x };
  }, []);

  const setStartFromPosition = useCallback(async (positionX) => {
    const { width } = trackBarRef.current;
    if (!width || !selected) return;
    const movable = width * (1 - trimWindowFraction);
    const clamped = Math.max(0, Math.min(movable, positionX));
    const ratio = movable > 0 ? clamped / movable : 0;
    const newStart = Math.round(ratio * maxStartMs);
    setStartMs(newStart);
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(newStart);
      } catch (_) {}
    }
  }, [selected, maxStartMs, trimWindowFraction]);

  const trimPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      runOnJS(setStartFromPosition)(e.x);
    })
    .onEnd((e) => {
      runOnJS(setStartFromPosition)(e.x);
    });

  // ─── Commit ────────────────────────────────────────────────────────────
  const commit = useCallback(async () => {
    if (!selected) return;
    await unloadAudio();
    const overlay = buildMusicOverlayPayload(selected, {
      startMs,
      display,
      source,
    });
    onPick?.(overlay);
  }, [selected, startMs, display, source, unloadAudio, onPick]);

  // ─── Dismiss / pan-to-close ────────────────────────────────────────────
  const dismiss = useCallback(async () => {
    Keyboard.dismiss();
    await unloadAudio();
    onClose && onClose();
  }, [onClose, unloadAudio]);

  const closePanGesture = Gesture.Pan()
    .activeOffsetY(15)
    .failOffsetY(-15)
    .onUpdate((e) => { if (e.translationY > 0) translateY.value = e.translationY; })
    .onEnd((e) => {
      if (e.translationY > 140 || e.velocityY > 700) {
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
    opacity: Math.max(0, 1 - translateY.value / SHEET_H) * 0.6,
  }));

  // ─── Pre-compute waveform bars (deterministic per-track) ───────────────
  const waveformBars = useMemo(() => {
    if (!selected) return [];
    const seed = (selected.id || '').split('').reduce((acc, c) => (acc + c.charCodeAt(0)) | 0, 0);
    const bars = [];
    for (let i = 0; i < 60; i++) {
      const v = Math.abs(Math.sin(seed * 0.13 + i * 0.41) * 0.6 + Math.cos(i * 0.83) * 0.4);
      bars.push(0.18 + Math.min(0.82, v));
    }
    return bars;
  }, [selected]);

  const isSearching = query.trim().length > 0;
  const listTracks = category === 'saved' && !isSearching ? savedTracks : results;
  const listLoading = loading;
  const showTrendBadge = category === 'trending' && !isSearching;

  if (!visible && translateY.value === SHEET_H) return null;

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ position: 'absolute', inset: 0, zIndex: 2000, elevation: 2000 }}
    >
      <Pressable onPress={dismiss} style={{ position: 'absolute', inset: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      <GestureHandlerRootView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          {/* Drag handle */}
          <GestureDetector gesture={closePanGesture}>
            <View style={styles.handleWrap}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>

          {/* Search */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Search songs or artists..."
                placeholderTextColor="rgba(255,255,255,0.38)"
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {loading ? <ActivityIndicator size="small" color="#1DB954" /> : null}
            </View>
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={{ flexGrow: 0 }}
          >
            {CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Track list */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: selected ? 320 : 24 }}
            showsVerticalScrollIndicator={false}
          >
            {listLoading && listTracks.length === 0 ? (
              <View style={{ paddingTop: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : !listLoading && listTracks.length === 0 ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 36, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>
                  {category === 'saved' ? 'No saved songs yet.' : 'No tracks found.'}
                </Text>
                {category === 'saved' ? (
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                    Tap the bookmark on a song to save it here.
                  </Text>
                ) : null}
              </View>
            ) : (
              <>
                {listTracks.length > 0 ? (
                  <Text style={styles.sectionTitle}>{sectionTitle}</Text>
                ) : null}
                {listTracks.length > 0 && !selected ? (
                  <FeaturedCard
                    track={listTracks[featuredIndex % listTracks.length]}
                    index={featuredIndex}
                    total={Math.min(listTracks.length, 4)}
                    onPress={() => handleSelectTrack(listTracks[featuredIndex % listTracks.length])}
                    onDotPress={setFeaturedIndex}
                  />
                ) : null}
                {listTracks.map((t, index) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    rank={!isSearching && category !== 'saved' && category !== 'original' ? index + 1 : null}
                    showTrendBadge={showTrendBadge}
                    isSelected={selected?.id === t.id}
                    isPlaying={selected?.id === t.id && playing}
                    isSaved={isTrackSaved(t)}
                    onPress={() => handleSelectTrack(t)}
                    onToggleSave={() => toggleSaved(t)}
                  />
                ))}
              </>
            )}
          </ScrollView>

          {/* Selected song panel (trim + display + use) */}
          {selected ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 18,
                paddingBottom: Math.max(insets.bottom, 14) + 14,
                paddingHorizontal: 18,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255,255,255,0.12)',
                shadowColor: '#000',
                shadowOpacity: 0.5,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: -8 },
                elevation: 24,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                {selected.cover_url ? (
                  <Image
                    source={{ uri: selected.cover_url }}
                    style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#222' }}
                  />
                ) : (
                  <View style={{
                    width: 64, height: 64, borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,200,1,0.25)',
                  }}
                  >
                    <Ionicons name="musical-note" size={28} color="rgba(255,255,255,0.85)" />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: -0.3 }}>
                    {selected.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 5, fontWeight: '600' }}>
                    {selected.artist}
                  </Text>
                </View>
                <Pressable
                  onPress={togglePlay}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: '#fff',
                    alignItems: 'center', justifyContent: 'center',
                    opacity: pressed ? 0.88 : 1,
                  })}
                >
                  <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#000" style={playing ? null : { marginLeft: 3 }} />
                </Pressable>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                {`${formatMs(startMs)} – ${formatMs(clipDurationMs)} · ${formatDuration(selected.duration_ms)}`}
              </Text>
              {!selected.preview_url ? (
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 8 }}>
                  No audio preview — sticker only
                </Text>
              ) : (
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 8 }}>
                  Preview loops for the full song segment
                </Text>
              )}
              {selected.preview_url ? (
                <GestureDetector gesture={trimPanGesture}>
                  <View
                    onLayout={onTrackBarLayout}
                    style={{
                      height: 68, borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      position: 'relative',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 2 }}>
                      {waveformBars.map((h, i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: `${h * 88}%`,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: 2,
                          }}
                        />
                      ))}
                    </View>
                    <Trimmable
                      startMs={startMs}
                      waveformBars={waveformBars}
                      clipDurationMs={clipDurationMs}
                      previewPlayableMs={previewPlayableMs}
                    />
                    <Playhead audioPos={audioPos} totalMs={clipDurationMs} />
                  </View>
                </GestureDetector>
              ) : null}

              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600', marginTop: 18, marginBottom: 10 }}>
                Display style
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
              >
                {DISPLAY_STYLES.map((s) => {
                  const active = display === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setDisplay(s.id)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 11,
                        borderRadius: 999,
                        backgroundColor: active ? '#fff' : '#262626',
                        opacity: pressed ? 0.88 : 1,
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                      })}
                    >
                      <Ionicons name={s.icon} size={15} color={active ? '#000' : 'rgba(255,255,255,0.85)'} />
                      <Text style={{
                        color: active ? '#000' : '#fff',
                        fontWeight: '800',
                        fontSize: 12,
                      }}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                onPress={commit}
                style={({ pressed }) => ({
                  marginTop: 16,
                  width: '100%',
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#3897F0',
                  opacity: pressed ? 0.9 : 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Done</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────
function FeaturedCard({ track, index, total, onPress, onDotPress }) {
  if (!track) return null;
  return (
    <View style={styles.featuredWrap}>
      <Pressable onPress={onPress} style={styles.featuredCard}>
        {track.cover_url ? (
          <Image
            source={{ uri: track.cover_url }}
            style={styles.featuredBg}
            blurRadius={Platform.OS === 'ios' ? 24 : 6}
          />
        ) : null}
        <View style={styles.featuredOverlay} />
        <View style={styles.featuredContent}>
          {track.cover_url ? (
            <Image source={{ uri: track.cover_url }} style={styles.featuredArt} />
          ) : (
            <View style={[styles.featuredArt, styles.artFallback]}>
              <Ionicons name="musical-note" size={24} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.featuredTitle}>{track.title}</Text>
            <Text numberOfLines={1} style={styles.featuredArtist}>{track.artist}</Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <Pressable key={i} onPress={() => onDotPress?.(i)} hitSlop={8}>
            <View style={[styles.dot, i === (index % total) && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TrackRow({
  track, rank, showTrendBadge, isSelected, isPlaying, isSaved, onPress, onToggleSave,
}) {
  const hasPreview = !!track?.preview_url;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.trackRow,
        isSelected && styles.trackRowSelected,
        { opacity: pressed ? 0.88 : (hasPreview ? 1 : 0.55) },
      ]}
    >
      {rank ? <Text style={styles.rank}>{rank}</Text> : null}

      <View style={styles.artWrap}>
        {track.cover_url ? (
          <Image source={{ uri: track.cover_url }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artFallback]}>
            <Ionicons name="musical-note" size={18} color="rgba(255,255,255,0.7)" />
          </View>
        )}
        {isSelected ? (
          <View style={styles.artPlayOverlay}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#fff" />
          </View>
        ) : null}
      </View>

      <View style={styles.trackMeta}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.trackTitle}>{track.title}</Text>
          {track.explicit ? (
            <View style={styles.explicitBadge}>
              <Text style={styles.explicitText}>E</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.subRow}>
          {showTrendBadge ? (
            <Ionicons name="trending-up" size={12} color="#1DB954" />
          ) : null}
          <Text numberOfLines={1} style={styles.trackArtist}>{track.artist}</Text>
          <Text style={styles.dotSep}>·</Text>
          <Text style={styles.trackDuration}>{formatDuration(track.duration_ms)}</Text>
        </View>
      </View>

      <Pressable onPress={onToggleSave} hitSlop={12} style={styles.saveBtn}>
        <Ionicons
          name={isSaved ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color={isSaved ? '#1DB954' : 'rgba(255,255,255,0.85)'}
        />
      </Pressable>
    </Pressable>
  );
}

function Trimmable({ startMs, waveformBars, clipDurationMs, previewPlayableMs }) {
  const windowFraction = clipDurationMs > 0
    ? Math.min(1, previewPlayableMs / clipDurationMs)
    : 1;
  const maxStart = Math.max(0, clipDurationMs - previewPlayableMs);
  const leftFraction = maxStart > 0 ? (startMs / maxStart) * (1 - windowFraction) : 0;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        left: `${leftFraction * 100}%`,
        width: `${windowFraction * 100}%`,
        borderWidth: 2,
        borderColor: '#3897F0',
        borderRadius: 8,
        backgroundColor: 'rgba(56,151,240,0.2)',
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 }}>
        {waveformBars.slice(0, Math.round(waveformBars.length * windowFraction)).map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${h * 80}%`,
              backgroundColor: '#3897F0',
              borderRadius: 1.5,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Playhead({ audioPos, totalMs }) {
  const left = `${(audioPos / Math.max(1, totalMs)) * 100}%`;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 4, bottom: 4,
        left,
        width: 2,
        backgroundColor: '#fff',
        borderRadius: 1,
        shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 3,
      }}
    />
  );
}

const styles = StyleSheet.create({
  sheet: {
    height: SHEET_H,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  searchWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    borderRadius: 999,
    backgroundColor: '#1c1c1c',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 0,
  },
  chipsRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1c1c1c',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    backgroundColor: '#1DB954',
    borderColor: '#1DB954',
  },
  chipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#000',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 16,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  featuredWrap: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  featuredCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 112,
    backgroundColor: '#1a1a1a',
  },
  featuredBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  featuredContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  featuredArt: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#222',
  },
  featuredTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  featuredArtist: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    marginTop: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  dotActive: {
    backgroundColor: '#1DB954',
    width: 18,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  trackRowSelected: {
    backgroundColor: 'rgba(29,185,84,0.08)',
  },
  rank: {
    width: 22,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginRight: 8,
  },
  artWrap: {
    width: 48,
    height: 48,
    flexShrink: 0,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  artFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },
  artPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    flexShrink: 1,
  },
  explicitBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 3,
  },
  explicitText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  trackArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flexShrink: 1,
  },
  dotSep: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
  trackDuration: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  saveBtn: {
    flexShrink: 0,
    padding: 4,
  },
});

