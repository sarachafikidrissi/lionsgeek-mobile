import { View, Text } from 'react-native';

/**
 * Single text overlay renderer.
 *
 * The overlay coordinates (x, y) are normalized to [0, 1] relative to the
 * media bounds, so the same overlay renders correctly on any viewport.
 * `containerSize` is the actual pixel size of the media on screen.
 *
 * Props:
 *   overlay        – { id, type:'text', x, y, scale, rotation, text, color, font, has_bg, bg_color }
 *   containerSize  – { width, height }
 *   selected       – boolean, draws a dashed outline when true (editor mode)
 *   style          – optional extra style
 *
 * Note: x and y are anchored at the CENTER of the overlay, so the visual
 *       feels balanced when dragging.
 */
export default function TextOverlay({ overlay, containerSize, selected = false, style }) {
  if (!overlay || !containerSize) return null;
  const cx = (overlay.x ?? 0.5) * containerSize.width;
  const cy = (overlay.y ?? 0.5) * containerSize.height;
  const scale = overlay.scale ?? 1;
  const rotation = overlay.rotation ?? 0;
  const fontSize = 28 * scale;
  const baseColor = overlay.color || '#ffffff';
  const hasBg = !!overlay.has_bg;
  const bgColor = overlay.bg_color || baseColor;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: cx,
          top: cy,
          transform: [
            { translateX: -0.5 * (overlay._measuredWidth || 0) },
            { translateY: -0.5 * (overlay._measuredHeight || 0) },
            { rotate: `${rotation}deg` },
          ],
          maxWidth: containerSize.width - 20,
        },
        selected && {
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.85)',
          borderStyle: 'dashed',
          borderRadius: 6,
          padding: 2,
        },
        style,
      ]}
    >
      <View
        style={{
          paddingHorizontal: hasBg ? 12 : 0,
          paddingVertical: hasBg ? 6 : 0,
          backgroundColor: hasBg ? bgColor : 'transparent',
          borderRadius: hasBg ? 8 : 0,
          alignSelf: 'flex-start',
        }}
      >
        <Text
          style={{
            color: hasBg ? pickContrastingText(bgColor) : baseColor,
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
    </View>
  );
}

// Picks white or black text depending on background luminance so it's
// always readable.
function pickContrastingText(hex) {
  if (!hex || typeof hex !== 'string') return '#000';
  const m = hex.replace('#', '');
  if (m.length < 6) return '#000';
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#000';
  // Per WCAG-ish luminance approximation.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}
