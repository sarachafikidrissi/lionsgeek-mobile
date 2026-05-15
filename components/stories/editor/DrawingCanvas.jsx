import { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const COLORS = [
  '#ffffff', '#000000',
  '#ffc801', '#ef4444', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#06b6d4',
];
const SIZES = [3, 6, 10, 16, 24];

/**
 * Full-canvas drawing mode. The whole story canvas becomes a pen surface
 * while this is mounted. Existing drawings appear underneath the new strokes.
 *
 * Behaviour:
 *   - Pan = draw a stroke
 *   - Release commits the stroke as one overlay
 *   - Color row + size dots at the bottom let you change tool
 *   - Undo removes the last stroke from the list this mode added
 *   - "Done" returns the final overlay list to the parent
 *   - "Cancel" discards everything added in this session
 *
 * Props:
 *   visible          – open/close
 *   containerSize    – { width, height } of the canvas
 *   existingDrawings – drawings that already exist on the story (rendered behind)
 *   onCommit(list)   – called with the final list of new drawing overlays
 *   onCancel
 */
export default function DrawingCanvas({
  visible,
  containerSize,
  existingDrawings = [],
  onCommit,
  onCancel,
}) {
  const [strokes, setStrokes] = useState([]); // committed new strokes
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(6);
  const [livePoints, setLivePoints] = useState([]); // current stroke (denorm px) for preview

  // Hold the raw points (normalized) for the in-progress stroke in a ref to
  // avoid setState-per-frame thrash during the pan.
  const liveRef = useRef([]);
  const dimsRef = useRef(containerSize);
  dimsRef.current = containerSize;

  const commitStroke = useCallback(() => {
    const pts = liveRef.current.slice();
    liveRef.current = [];
    setLivePoints([]);
    if (pts.length < 2) return;
    setStrokes((prev) => [
      ...prev,
      {
        id: `dw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'drawing',
        color,
        stroke_width: size,
        points: pts,
        x: 0.5, y: 0.5, scale: 1, rotation: 0,
      },
    ]);
  }, [color, size]);

  const pushLivePoint = useCallback((x, y) => {
    const { width, height } = dimsRef.current || { width: 0, height: 0 };
    if (width <= 0 || height <= 0) return;
    const nx = Math.max(0, Math.min(1, x / width));
    const ny = Math.max(0, Math.min(1, y / height));
    // Subsample: skip if the new point is too close to the previous to keep
    // payload size sane.
    const prev = liveRef.current[liveRef.current.length - 1];
    if (prev) {
      const dx = nx - prev[0];
      const dy = ny - prev[1];
      if (dx * dx + dy * dy < 0.00005) return;
    }
    liveRef.current.push([nx, ny]);
    // Throttle UI updates: only re-render every ~8 points.
    if (liveRef.current.length % 4 === 0) {
      setLivePoints(liveRef.current.slice());
    }
  }, []);

  const beginStroke = useCallback((x, y) => {
    liveRef.current = [];
    setLivePoints([]);
    pushLivePoint(x, y);
  }, [pushLivePoint]);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(beginStroke)(e.x, e.y); })
    .onUpdate((e) => { runOnJS(pushLivePoint)(e.x, e.y); })
    .onEnd(() => { runOnJS(commitStroke)(); });

  const undo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleDone = () => {
    onCommit?.(strokes);
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.0)',
      }}
    >
      {/* Drawing surface */}
      <GestureDetector gesture={panGesture}>
        <View style={{ flex: 1 }}>
          <Svg
            width={containerSize.width}
            height={containerSize.height}
            style={{ position: 'absolute', left: 0, top: 0 }}
            pointerEvents="none"
          >
            {/* Existing drawings (pre-this-session) */}
            {existingDrawings.map((s) => (
              <Path
                key={`old-${s.id}`}
                d={buildSmoothPath(s.points, containerSize.width, containerSize.height)}
                stroke={s.color || '#fff'}
                strokeWidth={Math.max(1, s.stroke_width || 6)}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {/* New committed strokes */}
            {strokes.map((s) => (
              <Path
                key={s.id}
                d={buildSmoothPath(s.points, containerSize.width, containerSize.height)}
                stroke={s.color}
                strokeWidth={Math.max(1, s.stroke_width)}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
            {/* Live in-progress stroke */}
            {livePoints.length >= 2 ? (
              <Path
                d={buildSmoothPath(livePoints, containerSize.width, containerSize.height)}
                stroke={color}
                strokeWidth={Math.max(1, size)}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null}
          </Svg>
        </View>
      </GestureDetector>

      {/* Top bar: Cancel / Undo / Done */}
      <View
        style={{
          position: 'absolute',
          top: Platform.OS === 'ios' ? 54 : 26,
          left: 16, right: 16,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Pressable onPress={onCancel} hitSlop={10} style={topBtn}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {strokes.length > 0 ? (
            <Pressable onPress={undo} hitSlop={10} style={topRoundBtn}>
              <Ionicons name="arrow-undo" size={18} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable onPress={handleDone} hitSlop={10} style={[topBtn, { backgroundColor: '#ffc801' }]}>
            <Text style={{ color: '#000', fontWeight: '800' }}>Done</Text>
          </Pressable>
        </View>
      </View>

      {/* Bottom: size dots + color row */}
      <View
        style={{
          position: 'absolute', bottom: Platform.OS === 'ios' ? 28 : 16,
          left: 0, right: 0,
          alignItems: 'center', gap: 12,
        }}
      >
        {/* Size dots */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          backgroundColor: 'rgba(0,0,0,0.45)',
          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        }}>
          {SIZES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSize(s)}
              hitSlop={6}
              style={{
                width: 30, height: 30,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: s + 6, height: s + 6, borderRadius: (s + 6) / 2,
                  backgroundColor: color,
                  borderWidth: size === s ? 2 : 0,
                  borderColor: '#fff',
                }}
              />
            </Pressable>
          ))}
        </View>

        {/* Color row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          style={{ maxHeight: 44, alignSelf: 'stretch' }}
        >
          {COLORS.map((c) => {
            const isSelected = c.toLowerCase() === color.toLowerCase();
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                hitSlop={4}
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: c,
                  borderWidth: 2,
                  borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.4)',
                  transform: [{ scale: isSelected ? 1.15 : 1 }],
                }}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function buildSmoothPath(normPoints, w, h) {
  const pts = normPoints.map(([x, y]) => [x * w, y * h]);
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0]} ${pts[i][1]}, ${xc} ${yc}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

const topBtn = {
  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  backgroundColor: 'rgba(0,0,0,0.55)',
};
const topRoundBtn = {
  width: 38, height: 38, borderRadius: 19,
  backgroundColor: 'rgba(0,0,0,0.45)',
  alignItems: 'center', justifyContent: 'center',
};
