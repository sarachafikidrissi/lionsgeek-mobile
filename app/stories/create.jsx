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
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode, Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context';
import API from '@/api';
import EditableOverlayLayer from '@/components/stories/editor/EditableOverlayLayer';
import TextInputModal from '@/components/stories/editor/TextInputModal';
import EmojiPickerSheet from '@/components/stories/editor/EmojiPickerSheet';
import DrawingCanvas from '@/components/stories/editor/DrawingCanvas';
import UserPickerSheet from '@/components/stories/editor/UserPickerSheet';
import MusicPickerSheet from '@/components/stories/editor/MusicPickerSheet';
import OverlayRenderer from '@/components/stories/OverlayRenderer';
import GradientOverlay from '@/components/ui/GradientOverlay';

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
  const insets = useSafeAreaInsets();

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
  /** When set, picking a user replaces this mention overlay instead of adding a new one. */
  const [mentionEditingId, setMentionEditingId] = useState(null);
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
    if (!user?.id) return;
    const displayName = (user.name || 'User').trim();
    const editId = mentionEditingId;

    if (editId) {
      setOverlays((prev) => prev.map((o) => (
        o.id === editId && o.type === 'mention'
          ? { ...o, user_id: user.id, username: displayName }
          : o
      )));
      setSelectedOverlayId(editId);
    } else {
      const newId = makeId();
      const o = {
        id: newId,
        type: 'mention',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        user_id: user.id,
        username: displayName,
        color: '#ffffff',
        has_bg: false,
        bg_color: null,
      };
      setOverlays((prev) => [...prev, o]);
      setSelectedOverlayId(newId);
    }
    setMentionEditingId(null);
    setMentionOpen(false);
  }, [mentionEditingId]);

  const openMentionPicker = useCallback(() => {
    setMentionEditingId(null);
    setMentionOpen(true);
  }, []);

  const editMentionOverlay = useCallback((overlay) => {
    if (overlay?.type === 'mention' && overlay?.id) {
      setMentionEditingId(overlay.id);
      setMentionOpen(true);
    }
  }, []);

  const addMusicOverlay = useCallback((data) => {
    if (!data?.preview_url) return;
    // Replace existing music overlay if present (one song per story, just like Instagram).
    const disp = data.display ?? 'none';
    const o = {
      id: makeId(),
      type: 'music',
      // Sound-only: tiny editor handle top-right; stickers default near top center.
      x: disp === 'none' ? 0.88 : 0.5,
      y: disp === 'none' ? 0.2 : 0.18,
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
      display:     disp,
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
    const statusTop = Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24;
    const bottomChromeClearance = Math.max(insets.bottom, 12) + 102;

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" />

        {/* Canvas = media + creative layer (measured for normalized coords) */}
        <View
          style={{ flex: 1, zIndex: 0, elevation: 0 }}
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
              onEditMention={editMentionOverlay}
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

        {/* Editor chrome above native Video/Image (BlurView can be invisible on some Android builds). */}
        {!drawingMode ? (
          <View
            pointerEvents="box-none"
            collapsable={false}
            style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 1000 }]}
          >
            {/* Top-left: close */}
            <View
              style={{
                position: 'absolute',
                top: statusTop + 6,
                left: 12,
              }}
            >
              <EditorGlassButton onPress={discard} disabled={uploading} accessibilityLabel="Discard story">
                <Ionicons name="close" size={24} color="#fff" />
              </EditorGlassButton>
            </View>

            {/* Right rail: creative tools — vertically centered between close and bottom bar */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                top: statusTop + 56,
                right: 8,
                bottom: bottomChromeClearance,
                justifyContent: 'center',
                alignItems: 'flex-end',
              }}
            >
              <View
                pointerEvents="box-none"
                style={{
                  maxWidth: 72,
                  maxHeight: '100%',
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 28,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <ScrollView
                  style={{ maxHeight: '100%' }}
                  contentContainerStyle={{
                    alignItems: 'flex-end',
                    gap: 11,
                    paddingBottom: 4,
                    flexGrow: 1,
                    justifyContent: 'center',
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
            {overlays.length > 0 ? (
              <EditorGlassButton onPress={undoLastOverlay} accessibilityLabel="Undo last">
                <Ionicons name="arrow-undo" size={20} color="#fff" />
              </EditorGlassButton>
            ) : null}

            <EditorGlassButton
              onPress={() => setTextModal({ open: true, editing: null })}
              accessibilityLabel="Add text"
            >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: -0.5 }}>Aa</Text>
            </EditorGlassButton>

            <EditorGlassButton onPress={() => setEmojiOpen(true)} accessibilityLabel="Add emoji">
              <Text style={{ fontSize: 22 }}>😊</Text>
            </EditorGlassButton>

            <EditorGlassButton onPress={openMentionPicker} accessibilityLabel="Mention someone">
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>@</Text>
            </EditorGlassButton>

            <EditorGlassButton onPress={() => setDrawingMode(true)} accessibilityLabel="Draw">
              <Ionicons name="pencil" size={20} color="#fff" />
            </EditorGlassButton>

            <EditorGlassButton
              onPress={() => setMusicOpen(true)}
              accessibilityLabel="Add music"
              active={hasMusicOverlay}
              activeTint="#1DB954"
            >
              <Ionicons
                name="musical-notes"
                size={20}
                color={hasMusicOverlay ? '#000' : '#fff'}
              />
            </EditorGlassButton>
                </ScrollView>
              </View>
            </View>

            {/* Bottom: audience + Share — LTR row so Share stays visible in RTL locales */}
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: Math.max(insets.bottom, 12) + 10,
                paddingTop: 14,
                paddingHorizontal: 14,
                backgroundColor: 'rgba(8,8,10,0.94)',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderTopWidth: 2,
                borderColor: 'rgba(255,200,1,0.35)',
              }}
            >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', direction: 'ltr' }}>
            <Pressable
              onPress={() => setAudience((a) => a === 'public' ? 'close_friends' : 'public')}
              onLongPress={() => router.push('/settings/close-friends')}
              delayLongPress={350}
              disabled={uploading}
              style={({ pressed }) => ({
                flexShrink: 1,
                maxWidth: '56%',
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: audience === 'close_friends'
                  ? 'rgba(34,197,94,0.95)'
                  : 'rgba(255,255,255,0.14)',
                opacity: pressed ? 0.88 : 1,
                borderWidth: 1.5,
                borderColor: audience === 'close_friends' ? '#22c55e' : 'rgba(255,255,255,0.22)',
              })}
            >
              <Ionicons
                name={audience === 'close_friends' ? 'star' : 'globe-outline'}
                size={16}
                color="#fff"
              />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                {audience === 'close_friends' ? 'Close friends' : 'Everyone'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.75)" />
            </Pressable>

            <Pressable
              onPress={submit}
              disabled={uploading}
              style={({ pressed }) => ({
                flexShrink: 0,
                minWidth: 136,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 999,
                backgroundColor: '#ffc801',
                opacity: pressed || uploading ? 0.82 : 1,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 10,
                marginLeft: 10,
              })}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="paper-plane" size={20} color="#fff" />
              )}
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }} numberOfLines={1}>
                {uploading ? 'Posting…' : 'Share'}
              </Text>
            </Pressable>
          </View>
          {audience === 'close_friends' ? (
            <Pressable
              onPress={() => router.push('/settings/close-friends')}
              hitSlop={6}
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>
                Edit close friends list
              </Text>
            </Pressable>
          ) : null}
            </View>
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
          onClose={() => { setMentionOpen(false); setMentionEditingId(null); }}
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
    <View style={{ flex: 1, backgroundColor: '#050508' }}>
      <StatusBar style="light" />

      <GradientOverlay
        colors={['rgba(255,200,1,0.12)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
        stops={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Pressable
        onPress={close}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6,
          left: 16,
          zIndex: 2,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,200,1,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: '#ffc801',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
          borderWidth: 3,
          borderColor: 'rgba(0,0,0,0.15)',
          shadowColor: '#ffc801',
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        }}
        >
          <Ionicons name="camera" size={40} color="#000" />
        </View>

        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 }}>
          New story
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10, textAlign: 'center', fontSize: 15, lineHeight: 22, fontWeight: '500' }}>
          Pick a photo or video. It disappears after 24 hours.
        </Text>

        <View style={{ width: '100%', marginTop: 40, gap: 14 }}>
          <Pressable
            onPress={captureFromCamera}
            style={({ pressed }) => ({
              paddingVertical: 18,
              borderRadius: 18,
              backgroundColor: pressed ? 'rgba(255,200,1,0.18)' : 'rgba(255,255,255,0.07)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderWidth: 1.5,
              borderColor: pressed ? 'rgba(255,200,1,0.45)' : 'rgba(255,255,255,0.14)',
            })}
          >
            <Ionicons name="camera-outline" size={22} color="#ffc801" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Camera</Text>
          </Pressable>

          <Pressable
            onPress={pickFromGallery}
            style={({ pressed }) => ({
              paddingVertical: 18,
              borderRadius: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.12)',
            })}
          >
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Gallery</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Circular control for the story editor chrome (solid fill — BlurView is unreliable on some Android GPUs). */
function EditorGlassButton({ children, onPress, disabled, active, activeTint, accessibilityLabel }) {
  const tint = activeTint || '#ffc801';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : (pressed ? 0.88 : 1),
        transform: [{ scale: pressed ? 0.94 : 1 }],
        borderWidth: active ? 2.5 : 2,
        borderColor: active ? tint : 'rgba(255,255,255,0.88)',
        backgroundColor: active ? tint : 'rgba(24,24,28,0.96)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 14,
      })}
    >
      {children}
    </Pressable>
  );
}
