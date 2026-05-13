import { View, Text, Pressable } from 'react-native';

/**
 * Mention overlay – an "@username" chip that's tappable in the viewer to
 * route to that user's profile.
 *
 * Props:
 *   overlay        – { id, type:'mention', x, y, scale, rotation, user_id, username, color, has_bg, bg_color }
 *   containerSize  – { width, height }
 *   selected       – editor-only (dashed outline)
 *   onPress        – viewer-only callback when the chip is tapped
 */
export default function MentionOverlay({ overlay, containerSize, selected = false, onPress }) {
  if (!overlay || !containerSize) return null;
  const cx = (overlay.x ?? 0.5) * containerSize.width;
  const cy = (overlay.y ?? 0.5) * containerSize.height;
  const scale = overlay.scale ?? 1;
  const rotation = overlay.rotation ?? 0;
  const fontSize = 22 * scale;
  const baseColor = overlay.color || '#ffffff';
  const hasBg = !!overlay.has_bg;
  const bgColor = overlay.bg_color || '#000000';

  const inner = (
    <View
      style={{
        paddingHorizontal: hasBg ? 14 : 6,
        paddingVertical: hasBg ? 7 : 3,
        backgroundColor: hasBg ? bgColor : 'rgba(0,0,0,0.55)',
        borderRadius: hasBg ? 999 : 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? 'rgba(255,255,255,0.9)' : 'transparent',
        borderStyle: 'dashed',
      }}
    >
      <Text
        style={{
          color: baseColor,
          fontSize,
          fontWeight: '900',
          textShadowColor: hasBg ? 'transparent' : 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
          letterSpacing: 0.2,
        }}
      >
        @{overlay.username}
      </Text>
    </View>
  );

  const wrapperStyle = {
    position: 'absolute',
    left: cx,
    top: cy,
    transform: [
      { translateX: -((overlay._measuredWidth || 0) / 2) || 0 },
      { translateY: -((overlay._measuredHeight || 0) / 2) || 0 },
      { rotate: `${rotation}deg` },
    ],
  };

  // In the viewer (when onPress is provided) the chip becomes tappable.
  if (typeof onPress === 'function') {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={({ pressed }) => [wrapperStyle, { opacity: pressed ? 0.7 : 1 }]}
      >
        {inner}
      </Pressable>
    );
  }

  // Read-only path (no taps).
  return (
    <View pointerEvents="none" style={wrapperStyle}>
      {inner}
    </View>
  );
}
