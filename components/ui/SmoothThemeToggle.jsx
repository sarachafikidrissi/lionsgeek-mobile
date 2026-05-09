import { useEffect } from 'react';
import { Pressable, Platform, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const TRACK_W = 52;
const TRACK_H = 31;
const THUMB = 26;
const PAD = 2;
/** Travel distance for thumb (track inner width minus thumb). */
const TRAVEL = TRACK_W - THUMB - PAD * 2;

const SPRING = {
  damping: 19,
  stiffness: 210,
  mass: 0.55,
};

/**
 * Dark / light theme toggle with smooth thumb slide and track tint transition.
 */
export default function SmoothThemeToggle({ value, onValueChange, accent = '#F5C518' }) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, SPRING);
  }, [value]);

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(120,120,120,0.42)', accent],
    ),
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      onPress={() => onValueChange(!value)}
    >
      <Animated.View style={[styles.track, trackAnimatedStyle]}>
        <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#fafafa',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.22,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
