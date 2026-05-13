import { View, Text, Pressable, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

/**
 * Editable overlay layer used inside the story editor.
 *
 * Each item supports:
 *   - Pan      → reposition (translation while gesture is active)
 *   - Pinch    → resize (scale)
 *   - Rotation → rotate (two-finger twist)
 *   - Tap      → select
 *   - Double tap on text/mention → re-open the editor for it
 *
 * On release we commit { x, y, scale, rotation } back to the parent.
 *
 * Drawings are NOT draggable (they're full-canvas strokes), so we skip
 * them here — the parent doesn't pass them in.
 */
export default function EditableOverlayLayer({
  overlays,
  containerSize,
  selectedId,
  onSelect,
  onDeselect,
  onUpdate,
  onDelete,
  onEditText,
  onEditMention,
}) {
  if (!containerSize || containerSize.width <= 0) return null;

  const backdropTap = Gesture.Tap().onEnd(() => runOnJS(onDeselect)());

  return (
    <View style={{ position: 'absolute', inset: 0 }}>
      <GestureDetector gesture={backdropTap}>
        <View style={{ position: 'absolute', inset: 0 }} />
      </GestureDetector>

      {overlays.map((o) => {
        if (o.type === 'drawing') return null;
        return (
          <DraggableOverlay
            key={o.id}
            overlay={o}
            containerSize={containerSize}
            isSelected={o.id === selectedId}
            onSelect={onSelect}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onEditText={onEditText}
            onEditMention={onEditMention}
          />
        );
      })}
    </View>
  );
}

function DraggableOverlay({
  overlay, containerSize, isSelected,
  onSelect, onUpdate, onDelete, onEditText, onEditMention,
}) {
  const baseX = (overlay.x ?? 0.5) * containerSize.width;
  const baseY = (overlay.y ?? 0.5) * containerSize.height;
  const baseScale = overlay.scale ?? 1;
  const baseRotation = overlay.rotation ?? 0;

  // Pan deltas (committed to overlay.x/y on release)
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  // Pinch/rotation deltas (committed on release)
  const scaleFactor = useSharedValue(1);    // multiplier applied during pinch
  const rotationDelta = useSharedValue(0);  // additional rotation during gesture
  // UI selection pop
  const selectPop = useSharedValue(isSelected ? 1.05 : 1);
  selectPop.value = withTiming(isSelected ? 1.05 : 1, { duration: 140 });

  // ── Pan ────────────────────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .minDistance(2)
    .onBegin(() => runOnJS(onSelect)(overlay.id))
    .onUpdate((e) => {
      offsetX.value = e.translationX;
      offsetY.value = e.translationY;
    })
    .onEnd((e) => {
      const nx = clamp((baseX + e.translationX) / containerSize.width, 0.02, 0.98);
      const ny = clamp((baseY + e.translationY) / containerSize.height, 0.02, 0.98);
      runOnJS(onUpdate)(overlay.id, { x: nx, y: ny });
      offsetX.value = 0;
      offsetY.value = 0;
    });

  // ── Pinch ──────────────────────────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => runOnJS(onSelect)(overlay.id))
    .onUpdate((e) => {
      scaleFactor.value = e.scale;
    })
    .onEnd((e) => {
      const newScale = clamp(baseScale * e.scale, 0.4, 5);
      runOnJS(onUpdate)(overlay.id, { scale: newScale });
      scaleFactor.value = 1;
    });

  // ── Rotation ───────────────────────────────────────────────────────
  const rotationGesture = Gesture.Rotation()
    .onBegin(() => runOnJS(onSelect)(overlay.id))
    .onUpdate((e) => {
      // e.rotation is in radians.
      rotationDelta.value = (e.rotation * 180) / Math.PI;
    })
    .onEnd((e) => {
      const degDelta = (e.rotation * 180) / Math.PI;
      const newRot = ((baseRotation + degDelta) % 360 + 360) % 360;
      runOnJS(onUpdate)(overlay.id, { rotation: newRot });
      rotationDelta.value = 0;
    });

  // ── Tap & double-tap ───────────────────────────────────────────────
  const tapGesture = Gesture.Tap()
    .maxDuration(220)
    .onEnd(() => { runOnJS(onSelect)(overlay.id); });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (overlay.type === 'text') runOnJS(onEditText)(overlay);
      else if (overlay.type === 'mention') runOnJS(onEditMention)(overlay);
    });

  // Compose: double-tap wins over single, pan/pinch/rotation run simultaneously.
  const composed = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture, tapGesture),
  );

  const containerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: baseX,
    top: baseY,
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scaleFactor.value * selectPop.value },
      { rotate: `${rotationDelta.value}deg` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={containerStyle}>
        <View style={{
          transform: [
            // Apply the saved (committed) scale + rotation in the inner layer
            // so the visual reflects the persisted state. The outer Animated.View
            // adds the LIVE gesture deltas on top.
            { scale: baseScale },
            { rotate: `${baseRotation}deg` },
          ],
        }}>
          {overlay.type === 'text' ? (
            <TextOverlayEditorView overlay={overlay} isSelected={isSelected} />
          ) : overlay.type === 'mention' ? (
            <MentionEditorView overlay={overlay} isSelected={isSelected} />
          ) : overlay.type === 'music' ? (
            <MusicEditorView overlay={overlay} isSelected={isSelected} />
          ) : (
            <StickerOverlayEditorView overlay={overlay} isSelected={isSelected} />
          )}
        </View>

        {isSelected ? (
          <Pressable
            onPress={() => onDelete(overlay.id)}
            hitSlop={10}
            style={{
              position: 'absolute',
              top: -22, right: -22,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: 'rgba(239,68,68,0.95)',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

function TextOverlayEditorView({ overlay, isSelected }) {
  const fontSize = 28;
  const baseColor = overlay.color || '#ffffff';
  const hasBg = !!overlay.has_bg;
  const bgColor = overlay.bg_color || baseColor;

  return (
    <View style={{
      paddingHorizontal: hasBg ? 12 : 4,
      paddingVertical: hasBg ? 6 : 2,
      backgroundColor: hasBg ? bgColor : 'transparent',
      borderRadius: hasBg ? 8 : 0,
      maxWidth: 320,
      borderWidth: isSelected ? 1 : 0,
      borderColor: isSelected ? 'rgba(255,255,255,0.9)' : 'transparent',
      borderStyle: 'dashed',
      transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    }}>
      <Text
        style={{
          color: hasBg ? pickContrasting(bgColor) : baseColor,
          fontSize,
          fontWeight: '800',
          textShadowColor: hasBg ? 'transparent' : 'rgba(0,0,0,0.55)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
          textAlign: 'center',
          lineHeight: fontSize * 1.15,
        }}
      >
        {overlay.text}
      </Text>
    </View>
  );
}

function StickerOverlayEditorView({ overlay, isSelected }) {
  const size = 56;
  return (
    <View
      style={{
        width: size, height: size,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: isSelected ? 1 : 0,
        borderColor: isSelected ? 'rgba(255,255,255,0.9)' : 'transparent',
        borderStyle: 'dashed',
        borderRadius: 8,
        transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
      }}
    >
      <Text
        style={{
          fontSize: size * 0.85,
          lineHeight: size,
          textAlign: 'center',
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {overlay.emoji}
      </Text>
    </View>
  );
}

function MusicEditorView({ overlay, isSelected }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        paddingRight: 12,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        maxWidth: 240,
        borderWidth: isSelected ? 1 : 0,
        borderColor: isSelected ? 'rgba(255,255,255,0.9)' : 'transparent',
        borderStyle: 'dashed',
        transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
      }}
    >
      {overlay.cover_url ? (
        <Image
          source={{ uri: overlay.cover_url }}
          style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: '#222' }}
        />
      ) : (
        <View
          style={{
            width: 30, height: 30, borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="musical-note" size={14} color="rgba(255,255,255,0.9)" />
        </View>
      )}
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
          {overlay.title || 'Music'}
        </Text>
        {!!overlay.artist && (
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>
            {overlay.artist}
          </Text>
        )}
      </View>
    </View>
  );
}

function MentionEditorView({ overlay, isSelected }) {
  const baseColor = overlay.color || '#ffffff';
  const hasBg = !!overlay.has_bg;
  const bgColor = overlay.bg_color || '#000000';
  return (
    <View style={{
      paddingHorizontal: hasBg ? 14 : 6,
      paddingVertical: hasBg ? 7 : 3,
      backgroundColor: hasBg ? bgColor : 'rgba(0,0,0,0.55)',
      borderRadius: hasBg ? 999 : 6,
      borderWidth: isSelected ? 1 : 0,
      borderColor: isSelected ? 'rgba(255,255,255,0.9)' : 'transparent',
      borderStyle: 'dashed',
      transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    }}>
      <Text style={{
        color: baseColor,
        fontSize: 22,
        fontWeight: '900',
        textShadowColor: hasBg ? 'transparent' : 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      }}>
        @{overlay.username}
      </Text>
    </View>
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function pickContrasting(hex) {
  if (!hex || typeof hex !== 'string') return '#000';
  const m = hex.replace('#', '');
  if (m.length < 6) return '#000';
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#000';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}
