import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

/**
 * Vertical legibility gradient overlay. Cheap (single SVG) and works without
 * any extra packages — we only need `react-native-svg`, which is already
 * installed.
 *
 * Props:
 *   colors   – array of CSS color strings (top → bottom)
 *   opacity  – multiplier applied to each stop (defaults to 1)
 *   stops    – matching array of 0..1 offsets (auto-distributed if omitted)
 *   pointerEvents – defaults to 'none' so the gradient never eats input
 *   style    – container style (typically absolute positioning)
 *
 * Examples:
 *   // Dark glow at the top of the viewer (under progress bars / header)
 *   <GradientOverlay
 *     colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
 *     style={{ position:'absolute', top:0, left:0, right:0, height:160 }}
 *   />
 */
export default function GradientOverlay({
  colors = ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)'],
  stops,
  opacity = 1,
  pointerEvents = 'none',
  style,
}) {
  const offsets = Array.isArray(stops) && stops.length === colors.length
    ? stops
    : colors.map((_, i) => i / (colors.length - 1));

  return (
    <View pointerEvents={pointerEvents} style={style}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            {colors.map((c, i) => (
              <Stop key={i} offset={offsets[i]} stopColor={c} stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}
