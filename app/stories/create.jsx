import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode, Audio } from 'expo-av';
import { useAppContext } from '@/context';
import API from '@/api';
import EditableOverlayLayer from '@/components/stories/editor/EditableOverlayLayer';
import TextInputModal from '@/components/stories/editor/TextInputModal';
import EmojiPickerSheet from '@/components/stories/editor/EmojiPickerSheet';
import DrawingCanvas from '@/components/stories/editor/DrawingCanvas';
import UserPickerSheet from '@/components/stories/editor/UserPickerSheet';
import MusicPickerSheet from '@/components/stories/editor/MusicPickerSheet';
import OverlayRenderer from '@/components/stories/OverlayRenderer';

/**
 * Story creation screen.
 *
 * Flow:
 *  1. User lands on a black sheet with two big actions: Camera / Gallery.
 *  2. After picking a photo or video, we preview it full-screen with a
 *     "Send" button.
 *  3. On Send, we upload to /api/mobile/stories (multipart) and pop back.
 *
 * No drawing / text / stickers in this MVP – just clean capture & upload.
 */
export default function CreateStoryScreen() {
  const router = useRouter();
  const { token } = useAppContext();

  const [media, setMedia] = useState(null); // { uri, type, duration, width, height, mimeType }
  const [uploading, setUploading] = useState(false);
  const [audience, setAudience] = useState('public'); // 'public' | 'close_friends'
  const [overlays, setOverlays] = useState([]); // creative layer
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [textModal, setTextModal] = useState({ open: false, editing: null });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const videoRef = useRef(null);
  const previewSoundRef = useRef(null);
  const hasMusicOverlay = overlays.some((o) => o.type === 'music');

  // Ensure audio playback works for video previews even in silent mode.
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
  }, []);

  // Preview the selected music track in the editor so the creator hears
  // exactly what will play on the story. Re-creates the Sound whenever
  // the music overlay's preview_url or trim range changes. Suspended while
  // the music picker is open (the picker plays its own preview).
  useEffect(() => {
    const musicOverlay = overlays.find((o) => o.type === 'music');
    let cancelled = false;

    (async () => {
      if (!musicOverlay?.preview_url || musicOpen) {
        if (previewSoundRef.current) {
          try { await previewSoundRef.current.stopAsync(); } catch (_) {}
          try { await previewSoundRef.current.unloadAsync(); } catch (_) {}
          previewSoundRef.current = null;
        }
        return;
      }
      // Reload with the current trim
      if (previewSoundRef.current) {
        try { await previewSoundRef.current.stopAsync(); } catch (_) {}
        try { await previewSoundRef.current.unloadAsync(); } catch (_) {}
        previewSoundRef.current = null;
      }
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: musicOverlay.preview_url },
          {
            shouldPlay: true,
            isLooping: true,
            volume: 0.85,
            positionMillis: musicOverlay.start_ms || 0,
          },
        );
        if (cancelled) {
          try { await sound.unloadAsync(); } catch (_) {}
          return;
        }
        previewSoundRef.current = sound;

        // Manually loop the [start_ms, end_ms] window since expo-av's native
        // looping only loops the entire file.
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status?.isLoaded) return;
          const end = musicOverlay.end_ms || 15000;
          if (status.positionMillis >= end - 50) {
            sound.setPositionAsync(musicOverlay.start_ms || 0).catch(() => {});
          }
        });
      } catch (_) {
        // Silently ignore; the creator will still see the sticker.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overlays.find((o) => o.type === 'music')?.preview_url,
      overlays.find((o) => o.type === 'music')?.start_ms,
      overlays.find((o) => o.type === 'music')?.end_ms,
      musicOpen]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        previewSoundRef.current.unloadAsync().catch(() => {});
        previewSoundRef.current = null;
      }
    };
  }, []);

  const normaliseAsset = (asset) => {
    if (!asset) return null;
    const isVideo = (asset.type === 'video') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(asset.uri || '');
    return {
      uri: asset.uri,
      type: isVideo ? 'video' : 'image',
      durationMs: asset.duration ? Math.round(asset.duration) : (isVideo ? 15000 : 5000),
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType,
    };
  };

  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'We need access to your media library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (result?.canceled) return;
      const asset = result.assets?.[0];
      const m = normaliseAsset(asset);
      if (m) setMedia(m);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not pick media.');
    }
  }, []);

  const captureFromCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'We need camera access.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (result?.canceled) return;
      const asset = result.assets?.[0];
      const m = normaliseAsset(asset);
      if (m) setMedia(m);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not capture.');
    }
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Overlay management
  // ────────────────────────────────────────────────────────────────────
  const makeId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const addTextOverlay = useCallback((data) => {
    if (textModal.editing) {
      setOverlays((prev) => prev.map((o) => o.id === textModal.editing.id ? {
        ...o,
        text: data.text,
        color: data.color,
        has_bg: data.has_bg,
        bg_color: data.bg_color,
      } : o));
    } else {
      const o = {
        id: makeId(),
        type: 'text',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        text: data.text,
        color: data.color,
        has_bg: data.has_bg,
        bg_color: data.bg_color,
        font: 'default',
      };
      setOverlays((prev) => [...prev, o]);
      setSelectedOverlayId(o.id);
    }
    setTextModal({ open: false, editing: null });
  }, [textModal.editing]);

  const addStickerOverlay = useCallback((emoji) => {
    const o = {
      id: makeId(),
      type: 'sticker',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      emoji,
    };
    setOverlays((prev) => [...prev, o]);
    setSelectedOverlayId(o.id);
  }, []);

  const addMentionOverlay = useCallback((user) => {
    if (!user?.id || !user?.name) return;
    const o = {
      id: makeId(),
      type: 'mention',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      user_id: user.id,
      username: user.name,
      color: '#ffffff',
      has_bg: false,
      bg_color: null,
    };
    setOverlays((prev) => [...prev, o]);
    setSelectedOverlayId(o.id);
    setMentionOpen(false);
  }, []);

  const addMusicOverlay = useCallback((data) => {
    if (!data?.preview_url) return;
    // Replace existing music overlay if present (one song per story, just like Instagram).
    const o = {
      id: makeId(),
      type: 'music',
      x: 0.5,
      y: 0.18, // place near the top by default
      scale: 1,
      rotation: 0,
      track_id:    data.track_id,
      title:       data.title,
      artist:      data.artist,
      album:       data.album,
      cover_url:   data.cover_url,
      preview_url: data.preview_url,
      start_ms:    data.start_ms ?? 0,
      end_ms:      data.end_ms ?? 15000,
      display:     data.display || 'pill',
      source:      data.source || 'spotify+itunes',
    };
    setOverlays((prev) => {
      const withoutMusic = prev.filter((p) => p.type !== 'music');
      return [...withoutMusic, o];
    });
    setSelectedOverlayId(o.id);
    setMusicOpen(false);
  }, []);

  const commitDrawingStrokes = useCallback((strokes) => {
    setDrawingMode(false);
    if (Array.isArray(strokes) && strokes.length > 0) {
      // Drawings stack underneath text/stickers so creative items stay on top.
      setOverlays((prev) => {
        const drawings = prev.filter((o) => o.type === 'drawing');
        const others = prev.filter((o) => o.type !== 'drawing');
        return [...drawings, ...strokes, ...others];
      });
    }
  }, []);

  const patchOverlay = useCallback((id, patch) => {
    setOverlays((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));
  }, []);

  const deleteOverlay = useCallback((id) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId((cur) => (cur === id ? null : cur));
  }, []);

  const editTextOverlay = useCallback((overlay) => {
    setTextModal({ open: true, editing: overlay });
  }, []);

  const undoLastOverlay = useCallback(() => {
    setOverlays((prev) => prev.slice(0, -1));
    setSelectedOverlayId(null);
  }, []);

  const submit = useCallback(async () => {
    if (!media || !token) return;
    setUploading(true);
    try {
      // Strip transient fields like _measuredWidth.
      const cleanOverlays = overlays.map(({ _measuredWidth, _measuredHeight, ...rest }) => rest);
      await API.createStory({
        uri: media.uri,
        type: media.type,
        durationMs: media.durationMs,
        width: media.width,
        height: media.height,
        mimeType: media.mimeType,
        audience,
        overlays: cleanOverlays,
      }, token);
      router.replace('/(tabs)');
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Upload failed';
      Alert.alert('Could not post story', msg);
    } finally {
      setUploading(false);
    }
  }, [media, token, router, audience, overlays]);

  const close = () => router.back();
  const discard = () => {
    setMedia(null);
    setOverlays([]);
    setSelectedOverlayId(null);
  };

  // ────────────────────────────────────────────────────────────────────
  // Preview
  // ────────────────────────────────────────────────────────────────────
  if (media) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" />

        {/* Canvas = media + creative layer (measured for normalized coords) */}
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== canvasSize.width || height !== canvasSize.height) {
              setCanvasSize({ width, height });
            }
          }}
        >
          {media.type === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: media.uri }}
              style={{ flex: 1 }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              isMuted={hasMusicOverlay}
              useNativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: media.uri }}
              style={{ flex: 1 }}
              resizeMode="contain"
            />
          )}

          {/* Drawings render as a non-interactive layer underneath the
              editable elements (text / stickers / mentions). */}
          <OverlayRenderer
            overlays={overlays.filter((o) => o.type === 'drawing')}
          />

          {!drawingMode ? (
            <EditableOverlayLayer
              overlays={overlays}
              containerSize={canvasSize}
              selectedId={selectedOverlayId}
              onSelect={setSelectedOverlayId}
              onDeselect={() => setSelectedOverlayId(null)}
              onUpdate={patchOverlay}
              onDelete={deleteOverlay}
              onEditText={editTextOverlay}
              onEditMention={() => setMentionOpen(true)}
            />
          ) : null}

          {/* When in drawing mode, this full-canvas layer takes over input. */}
          <DrawingCanvas
            visible={drawingMode}
            containerSize={canvasSize}
            existingDrawings={overlays.filter((o) => o.type === 'drawing')}
            onCancel={() => setDrawingMode(false)}
            onCommit={commitDrawingStrokes}
          />
        </View>

        {/* Top bar: discard + tools — hidden while drawing */}
        {!drawingMode ? (
          <View style={{
            position: 'absolute',
            top: (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6,
            left: 16, right: 16,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <Pressable
              onPress={discard}
              disabled={uploading}
              hitSlop={12}
              style={topRoundBtn}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {overlays.length > 0 ? (
                <Pressable onPress={undoLastOverlay} hitSlop={10} style={topRoundBtn}>
                  <Ionicons name="arrow-undo" size={18} color="#fff" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setMusicOpen(true)}
                hitSlop={10}
                style={[
                  topRoundBtn,
                  hasMusicOverlay
                    ? { backgroundColor: '#1DB954', shadowColor: '#1DB954', shadowOpacity: 0.4, shadowRadius: 8 }
                    : null,
                ]}
              >
                <Ionicons
                  name="musical-notes"
                  size={18}
                  color={hasMusicOverlay ? '#000' : '#fff'}
                />
              </Pressable>

              <Pressable onPress={() => setDrawingMode(true)} hitSlop={10} style={topRoundBtn}>
                <Ionicons name="pencil" size={18} color="#fff" />
              </Pressable>

              <Pressable onPress={() => setMentionOpen(true)} hitSlop={10} style={topRoundBtn}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17 }}>@</Text>
              </Pressable>

              <Pressable onPress={() => setEmojiOpen(true)} hitSlop={10} style={topRoundBtn}>
                <Text style={{ fontSize: 18 }}>😊</Text>
              </Pressable>

              <Pressable
                onPress={() => setTextModal({ open: true, editing: null })}
                hitSlop={10}
                style={topRoundBtn}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: -0.5 }}>
                  Aa
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Bottom: audience toggle + send — hidden while drawing */}
        {!drawingMode ? (
        <View style={{
          position: 'absolute', bottom: 32, left: 16, right: 16,
          flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <View style={{ alignItems: 'flex-start', gap: 6 }}>
            <Pressable
              onPress={() => setAudience((a) => a === 'public' ? 'close_friends' : 'public')}
              onLongPress={() => router.push('/settings/close-friends')}
              delayLongPress={350}
              disabled={uploading}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: audience === 'close_friends'
                  ? 'rgba(34,197,94,0.92)'
                  : 'rgba(0,0,0,0.55)',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons
                name={audience === 'close_friends' ? 'star' : 'globe-outline'}
                size={14}
                color="#fff"
              />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                {audience === 'close_friends' ? 'Close Friends' : 'Everyone'}
              </Text>
            </Pressable>
            {audience === 'close_friends' ? (
              <Pressable
                onPress={() => router.push('/settings/close-friends')}
                hitSlop={6}
              >
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, textDecorationLine: 'underline' }}>
                  Edit list
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={submit}
            disabled={uploading}
            style={({ pressed }) => ({
              paddingHorizontal: 22, paddingVertical: 14,
              borderRadius: 999,
              backgroundColor: '#ffc801',
              opacity: pressed || uploading ? 0.7 : 1,
              flexDirection: 'row', alignItems: 'center', gap: 8,
              shadowColor: '#000', shadowOpacity: 0.35,
              shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
              elevation: 10,
            })}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="paper-plane" size={16} color="#000" />
            )}
            <Text style={{ color: '#000', fontWeight: '800', letterSpacing: 0.3 }}>
              {uploading ? 'Posting…' : 'Share to story'}
            </Text>
          </Pressable>
        </View>
        ) : null}

        {/* Text input modal */}
        <TextInputModal
          visible={textModal.open}
          initial={textModal.editing || null}
          onCancel={() => setTextModal({ open: false, editing: null })}
          onSubmit={addTextOverlay}
        />

        {/* Emoji picker */}
        <EmojiPickerSheet
          visible={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onPick={addStickerOverlay}
        />

        {/* User picker for @mentions */}
        <UserPickerSheet
          visible={mentionOpen}
          onClose={() => setMentionOpen(false)}
          onPick={addMentionOverlay}
        />

        {/* Music picker */}
        <MusicPickerSheet
          visible={musicOpen}
          onClose={() => setMusicOpen(false)}
          onPick={addMusicOverlay}
        />
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Picker (initial sheet)
  // ────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />

      <Pressable
        onPress={close}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6,
          left: 16, zIndex: 2,
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{
          width: 78, height: 78, borderRadius: 39,
          backgroundColor: '#ffc801',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <Ionicons name="camera" size={36} color="#000" />
        </View>

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
          Share a moment
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 8, textAlign: 'center' }}>
          Stories disappear after 24 hours.
        </Text>

        <View style={{ width: '100%', marginTop: 36, gap: 12 }}>
          <Pressable
            onPress={captureFromCamera}
            style={({ pressed }) => ({
              paddingVertical: 16, borderRadius: 14,
              backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            })}
          >
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Take photo or video
            </Text>
          </Pressable>

          <Pressable
            onPress={pickFromGallery}
            style={({ pressed }) => ({
              paddingVertical: 16, borderRadius: 14,
              backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
            })}
          >
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Choose from gallery
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const topRoundBtn = {
  width: 38,
  height: 38,
  borderRadius: 19,
  backgroundColor: 'rgba(0,0,0,0.45)',
  alignItems: 'center',
  justifyContent: 'center',
};
