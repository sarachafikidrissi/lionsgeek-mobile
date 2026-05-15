import { useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

/**
 * Six-emoji quick-react row. Tap an emoji → it floats upward with a fade out,
 * and we report the choice to the parent (which talks to the API and pauses
 * the story while doing so).
 *
 * Props:
 *   currentReaction  – the currently-saved emoji for this story (e.g. "❤️")
 *   onReact(emoji)   – called with the selected emoji
 *   onLongPress()    – optional, for "long press = open emoji picker" later
 */
const EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

export default function EmojiReactionRow({ currentReaction, onReact }) {
  // Floating animations for each slot are stored in refs so re-renders don't
  // reset them.
  const [floats, setFloats] = useState([]); // [{ id, emoji, x }]

  const handleTap = useCallback((emoji, evt) => {
    const x = evt?.nativeEvent?.pageX ?? 0;
    const id = Math.random().toString(36).slice(2);
    setFloats((prev) => [...prev, { id, emoji, x }]);
    onReact && onReact(emoji);
    // Auto-cleanup after the animation completes.
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 1400);
  }, [onReact]);

  return (
    <View style={styles.wrap}>
      {/* Floating layer */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {floats.map((f) => (
          <FloatingEmoji key={f.id} emoji={f.emoji} startX={f.x} />
        ))}
      </View>

      {/* The actual buttons */}
      <View style={styles.row}>
        {EMOJIS.map((e) => {
          const isSelected = currentReaction === e;
          return (
            <Pressable
              key={e}
              onPress={(evt) => handleTap(e, evt)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.btn,
                isSelected && styles.btnSelected,
                pressed && { transform: [{ scale: 1.18 }] },
              ]}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FloatingEmoji({ emoji, startX }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.6);

  // Run on mount.
  useAnimateOnMount(() => {
    scale.value = withSequence(
      withTiming(1.4, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withTiming(1.1, { duration: 180 })
    );
    translateY.value = withTiming(-140, { duration: 1200, easing: Easing.out(Easing.quad) });
    opacity.value = withDelay(400, withTiming(0, { duration: 800 }));
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        {
          position: 'absolute',
          bottom: 20,
          left: startX - 18,
          fontSize: 36,
          textShadowColor: 'rgba(0,0,0,0.4)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        },
        style,
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// Lightweight "useEffect on first paint" helper that runs once per mount.
function useAnimateOnMount(fn) {
  const fired = useRef(false);
  if (!fired.current) {
    fired.current = true;
    // Defer one tick so shared values aren't mutated during render.
    setTimeout(fn, 0);
  }
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  btn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  btnSelected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  emoji: { fontSize: 26 },
});
