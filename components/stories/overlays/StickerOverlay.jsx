import { View, Text } from 'react-native';

/**
 * Single emoji sticker overlay.
 *
 * Props:
 *   overlay        – { id, type:'sticker', x, y, scale, rotation, emoji }
 *   containerSize  – { width, height }
 *   selected       – boolean
 */
export default function StickerOverlay({ overlay, containerSize, selected = false, style }) {
  if (!overlay || !containerSize) return null;
  const cx = (overlay.x ?? 0.5) * containerSize.width;
  const cy = (overlay.y ?? 0.5) * containerSize.height;
  const scale = overlay.scale ?? 1;
  const rotation = overlay.rotation ?? 0;
  // Base emoji size — scaled up by 'scale'
  const size = 56 * scale;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: `${rotation}deg` }],
        },
        selected && {
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.85)',
          borderStyle: 'dashed',
          borderRadius: 6,
        },
        style,
      ]}
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
