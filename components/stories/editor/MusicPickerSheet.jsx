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

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const SHEET_H = Math.round(WINDOW_H * 0.82);

// The audio previews from Spotify / iTunes are 30 seconds long. We attach a
// 15-second slice; users can drag a window across the preview to pick which
// 15 seconds play during the story.
const PREVIEW_DURATION_MS = 30_000;
const CLIP_DURATION_MS    = 15_000;

const DISPLAY_STYLES = [
  { id: 'pill',    label: 'Pill',    icon: 'radio-button-on' },
  { id: 'card',    label: 'Card',    icon: 'square' },
  { id: 'minimal', label: 'Minimal', icon: 'remove' },
];

/**
 * Bottom sheet for the story creator's music sticker.
 *
 *  - Search box (Spotify-backed, iTunes fallback for previews)
 *  - Tap a row to start an in-sheet audio preview
 *  - Drag the 15-second window across the 30-second waveform to choose the
 *    clip start
 *  - Pick a display variant (pill / card / minimal)
 *  - "Use this song" returns a fully-formed music overlay payload
 *
 * Props:
 *   visible
 *   onClose()
 *   onPick(overlayData) – { type:'music', track_id, title, artist, album,
 *                           cover_url, preview_url, start_ms, end_ms,
 *                           display, source }
 */
export default function MusicPickerSheet({ visible, onClose, onPick }) {
  const { token } = useAppContext();
  const translateY = useSharedValue(SHEET_H);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null); // 'spotify+itunes' | 'itunes'
  const [selected, setSelected] = useState(null);
  const [startMs, setStartMs] = useState(0);
  const [display, setDisplay] = useState('pill');
  const [playing, setPlaying] = useState(false);
  const inputRef = useRef(null);
  const soundRef = useRef(null);
  const positionTimerRef = useRef(null);
  const [audioPos, setAudioPos] = useState(0); // ms within preview

  // ─── Show / hide animation ─────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
      setTimeout(() => inputRef.current?.focus?.(), 220);
    } else {
      translateY.value = withTiming(SHEET_H, { duration: 200 });
      // Reset state once the sheet fully leaves the screen
      setTimeout(() => {
        setQuery('');
        setResults([]);
        setSelected(null);
        setStartMs(0);
        setDisplay('pill');
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

  // ─── Search (debounced) ────────────────────────────────────────────────
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
        const data = await API.searchMusic(q, token, { limit: 25 });
        if (cancelled) return;
        setSource(data?.source || null);
        const items = Array.isArray(data?.items) ? data.items : [];
        // Only show tracks we can actually preview.
        setResults(items.filter((x) => !!x.preview_url));
      } catch (_) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, token, visible]);

  // ─── Track selection + playback ────────────────────────────────────────
  const playTrack = useCallback(async (track) => {
    await unloadAudio();
    if (!track?.preview_url) {
      Alert.alert('No preview', 'This track does not have a playable preview.');
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
    await playTrack(track);
  }, [playTrack]);

  // ─── Trim slider ───────────────────────────────────────────────────────
  // 30s preview, 15s window → start can move from 0 → 15s.
  const trackBarRef = useRef({ width: 0, x: 0 });
  const onTrackBarLayout = useCallback((e) => {
    const { width, x } = e.nativeEvent.layout;
    trackBarRef.current = { width, x };
  }, []);

  const setStartFromPosition = useCallback(async (positionX) => {
    const { width } = trackBarRef.current;
    if (!width) return;
    // Movable area is [0, width * 0.5] because the window is 15s of 30s.
    const movable = width * 0.5;
    const clamped = Math.max(0, Math.min(movable, positionX));
    const ratio = clamped / movable;
    const newStart = Math.round(ratio * (PREVIEW_DURATION_MS - CLIP_DURATION_MS));
    setStartMs(newStart);
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(newStart);
      } catch (_) {}
    }
  }, []);

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
    const overlay = {
      type:        'music',
      track_id:    selected.id,
      title:       selected.title,
      artist:      selected.artist,
      album:       selected.album,
      cover_url:   selected.cover_url,
      preview_url: selected.preview_url,
      start_ms:    Math.max(0, Math.min(PREVIEW_DURATION_MS - CLIP_DURATION_MS, startMs)),
      end_ms:      Math.max(0, Math.min(PREVIEW_DURATION_MS, startMs + CLIP_DURATION_MS)),
      display,
      source:      selected.source || source || 'spotify+itunes',
    };
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

  if (!visible && translateY.value === SHEET_H) return null;

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={{ position: 'absolute', inset: 0 }}>
      <Pressable onPress={dismiss} style={{ position: 'absolute', inset: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      <GestureHandlerRootView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <Animated.View style={[{
          height: SHEET_H,
          backgroundColor: '#0d0d0d',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          overflow: 'hidden',
        }, sheetStyle]}>
          {/* Drag handle + header (drag area only on top section) */}
          <GestureDetector gesture={closePanGesture}>
            <View>
              <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 6 }}>
                <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              </View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 18, paddingBottom: 10,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="musical-notes" size={18} color="#1DB954" />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Add music</Text>
                </View>
                <Pressable onPress={dismiss} hitSlop={10}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          {/* Search box */}
          <View style={{
            marginHorizontal: 14, marginBottom: 10,
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
              placeholder="Search song, artist, lyrics…"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 0 }}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {loading ? <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" /> : null}
          </View>

          {/* Track list */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 280 }}
          >
            {!query.trim() ? (
              <EmptyState onPickSuggestion={setQuery} />
            ) : !loading && results.length === 0 ? (
              <View style={{ paddingHorizontal: 20, paddingTop: 36, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)' }}>No tracks found.</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                  Try a different artist or song title.
                </Text>
              </View>
            ) : (
              results.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  isSelected={selected?.id === t.id}
                  isPlaying={selected?.id === t.id && playing}
                  onPress={() => handleSelectTrack(t)}
                />
              ))
            )}
          </ScrollView>

          {/* Selected song panel (trim + display + use) */}
          {selected ? (
            <View
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                backgroundColor: '#1a1a1a',
                borderTopLeftRadius: 18, borderTopRightRadius: 18,
                paddingTop: 12,
                paddingBottom: Platform.OS === 'ios' ? 28 : 18,
                paddingHorizontal: 16,
                shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10,
                shadowOffset: { width: 0, height: -4 },
                elevation: 18,
              }}
            >
              {/* Selected track info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {selected.cover_url ? (
                  <Image source={{ uri: selected.cover_url }} style={{ width: 42, height: 42, borderRadius: 6, backgroundColor: '#222' }} />
                ) : (
                  <View style={{ width: 42, height: 42, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="musical-note" size={18} color="rgba(255,255,255,0.85)" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                    {selected.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                    {selected.artist}
                  </Text>
                </View>
                <Pressable
                  onPress={togglePlay}
                  hitSlop={10}
                  style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: '#1DB954',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#000" />
                </Pressable>
              </View>

              {/* Trim slider */}
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 6, fontWeight: '600', letterSpacing: 0.3 }}>
                {`Clip · ${formatMs(startMs)} – ${formatMs(startMs + CLIP_DURATION_MS)}`}
              </Text>
              <GestureDetector gesture={trimPanGesture}>
                <View
                  onLayout={onTrackBarLayout}
                  style={{
                    height: 56, borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {/* Waveform bars */}
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 2 }}>
                    {waveformBars.map((h, i) => (
                      <View
                        key={i}
                        style={{
                          flex: 1,
                          height: `${h * 90}%`,
                          backgroundColor: 'rgba(255,255,255,0.22)',
                          borderRadius: 1.5,
                        }}
                      />
                    ))}
                  </View>
                  {/* Selected window */}
                  <Trimmable
                    startMs={startMs}
                    waveformBars={waveformBars}
                  />
                  {/* Playhead */}
                  <Playhead audioPos={audioPos} />
                </View>
              </GestureDetector>

              {/* Display style picker + Use button */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
                  {DISPLAY_STYLES.map((s) => {
                    const active = display === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setDisplay(s.id)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10, paddingVertical: 8,
                          borderRadius: 999,
                          backgroundColor: active ? '#1DB954' : 'rgba(255,255,255,0.08)',
                          opacity: pressed ? 0.85 : 1,
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                        })}
                      >
                        <Ionicons name={s.icon} size={11} color={active ? '#000' : '#fff'} />
                        <Text style={{
                          color: active ? '#000' : '#fff',
                          fontWeight: '800',
                          fontSize: 11,
                        }}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable
                  onPress={commit}
                  style={({ pressed }) => ({
                    paddingHorizontal: 18, paddingVertical: 11,
                    borderRadius: 999,
                    backgroundColor: '#ffc801',
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  })}
                >
                  <Ionicons name="checkmark" size={14} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </View>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────
function TrackRow({ track, isSelected, isPlaying, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: isSelected ? 'rgba(29,185,84,0.10)' : 'transparent',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {track.cover_url ? (
        <Image source={{ uri: track.cover_url }} style={{ width: 46, height: 46, borderRadius: 6, backgroundColor: '#222' }} />
      ) : (
        <View style={{
          width: 46, height: 46, borderRadius: 6,
          backgroundColor: 'rgba(255,255,255,0.08)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="musical-note" size={20} color="rgba(255,255,255,0.85)" />
        </View>
      )}
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
          {track.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, flexShrink: 1 }}>
            {track.artist}
          </Text>
          {track.explicit ? (
            <View style={{
              paddingHorizontal: 4, paddingVertical: 1,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 3,
            }}>
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>E</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: isSelected ? '#1DB954' : 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons
          name={isSelected && isPlaying ? 'pause' : 'play'}
          size={14}
          color={isSelected ? '#000' : '#fff'}
        />
      </View>
    </Pressable>
  );
}

function Trimmable({ startMs, waveformBars }) {
  // Window covers 50% of the bar (15s of 30s preview).
  // Left edge: startMs / (PREVIEW - CLIP) * 50%
  const windowFraction = 0.5;
  const leftFraction = (startMs / (PREVIEW_DURATION_MS - CLIP_DURATION_MS)) * (1 - windowFraction);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, bottom: 0,
        left: `${leftFraction * 100}%`,
        width: `${windowFraction * 100}%`,
        borderWidth: 2,
        borderColor: '#1DB954',
        borderRadius: 8,
        backgroundColor: 'rgba(29,185,84,0.18)',
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 }}>
        {waveformBars.slice(0, Math.round(waveformBars.length * windowFraction)).map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${h * 80}%`,
              backgroundColor: '#1DB954',
              borderRadius: 1.5,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Playhead({ audioPos }) {
  const left = `${(audioPos / PREVIEW_DURATION_MS) * 100}%`;
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

function EmptyState({ onPickSuggestion }) {
  const suggestions = ['Drake', 'Taylor Swift', 'The Weeknd', 'Bad Bunny', 'Bruno Mars', 'Daft Punk'];
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 24, alignItems: 'center' }}>
      <Ionicons name="musical-notes-outline" size={42} color="rgba(255,255,255,0.4)" />
      <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10, textAlign: 'center', fontSize: 13 }}>
        Search for any song to add it to your story.
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 18, marginBottom: 8, fontSize: 11, letterSpacing: 0.6 }}>
        TRY
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        {suggestions.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPickSuggestion?.(s)}
            style={({ pressed }) => ({
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: pressed ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
            })}
          >
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function formatMs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}
