import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * Lightweight Discord-like shimmer skeleton.
 * Use fixed width/height for best results (especially in lists).
 */
export default function Skeleton({ width, height, borderRadius = 12, isDark = false, style }) {
  const shimmerTranslateX = useSharedValue(-Math.max(140, typeof width === 'number' ? width : 320));

  useEffect(() => {
    shimmerTranslateX.value = withRepeat(
      withTiming(Math.max(140, typeof width === 'number' ? width : 320), { duration: 1100 }),
      -1,
      false
    );
  }, [shimmerTranslateX, width]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslateX.value }],
  }));

  const baseColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const highlightColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)';
  const resolvedWidth = width ?? '100%';
  const resolvedHeight = height ?? 12;

  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width:
              typeof resolvedWidth === 'number'
                ? Math.max(140, Math.round(resolvedWidth * 0.45))
                : 180,
            backgroundColor: highlightColor,
            opacity: 0.9,
          },
          shimmerStyle,
        ]}
      />
    </View>
  );
}

