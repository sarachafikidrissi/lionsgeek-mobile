import { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

/**
 * Read-only music sticker overlay.
 *
 * Renders the Instagram-style "now playing" pill: cover art + title + artist
 * + three animated bars. Positioned using normalized coords (x, y) in the
 * containerSize, with scale + rotation applied.
 *
 * Three visual variants (controlled by overlay.display):
 *   - 'pill'    – horizontal capsule with title • artist
 *   - 'card'    – cover-large card with title stacked
 *   - 'minimal' – tiny note icon + title only
 *
 * `animated` controls the bouncing bars (paused while the story is paused).
 */
export default function MusicOverlay({ overlay, containerSize, animated = true }) {
  if (!overlay || !containerSize || containerSize.width <= 0) return null;

  const x = (overlay.x ?? 0.5) * containerSize.width;
  const y = (overlay.y ?? 0.5) * containerSize.height;
  const scale = overlay.scale ?? 1;
  const rotation = overlay.rotation ?? 0;
  const display = overlay.display || 'pill';

  if (display === 'none') return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: [
          { translateX: -90 * scale },
          { translateY: -22 * scale },
          { scale },
          { rotate: `${rotation}deg` },
        ],
      }}
    >
      {display === 'card' ? (
        <CardChip overlay={overlay} animated={animated} />
      ) : display === 'minimal' ? (
        <MinimalChip overlay={overlay} animated={animated} />
      ) : (
        <PillChip overlay={overlay} animated={animated} />
      )}
    </View>
  );
}

// ─── Pill (default) ──────────────────────────────────────────────────────
function PillChip({ overlay, animated }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 4,
        paddingRight: 14,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.55)',
        maxWidth: 280,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Cover overlay={overlay} size={32} radius={999} />
      <AnimatedBars active={animated} size="sm" />
      <View style={{ flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: '#fff',
            fontSize: 12.5,
            fontWeight: '700',
            letterSpacing: 0.1,
          }}
        >
          {overlay.title || 'Untitled'}
        </Text>
        {!!overlay.artist && (
          <Text
            numberOfLines={1}
            style={{
              color: 'rgba(255,255,255,0.78)',
              fontSize: 10.5,
              fontWeight: '500',
            }}
          >
            {overlay.artist}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Card (bigger, square-ish) ───────────────────────────────────────────
function CardChip({ overlay, animated }) {
  return (
    <View
      style={{
        padding: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: 240,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Cover overlay={overlay} size={42} radius={8} />
      <View style={{ flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AnimatedBars active={animated} size="md" />
          <Text
            numberOfLines={1}
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '800',
              flexShrink: 1,
            }}
          >
            {overlay.title || 'Untitled'}
          </Text>
        </View>
        {!!overlay.artist && (
          <Text
            numberOfLines={1}
            style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500', marginTop: 2 }}
          >
            {overlay.artist}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Minimal (icon + title only) ─────────────────────────────────────────
function MinimalChip({ overlay, animated }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        maxWidth: 240,
      }}
    >
      <Ionicons name="musical-notes" size={13} color="#fff" />
      <AnimatedBars active={animated} size="sm" />
      <Text
        numberOfLines={1}
        style={{ color: '#fff', fontSize: 12, fontWeight: '700', flexShrink: 1 }}
      >
        {overlay.title || 'Music'}
      </Text>
    </View>
  );
}

// ─── Sub-elements ────────────────────────────────────────────────────────
function Cover({ overlay, size, radius }) {
  if (overlay.cover_url) {
    return (
      <Image
        source={{ uri: overlay.cover_url }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#222' }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="musical-note" size={size * 0.5} color="rgba(255,255,255,0.85)" />
    </View>
  );
}

function AnimatedBars({ active, size = 'sm' }) {
  const dim = size === 'md' ? 3 : 2.4;
  const h1 = useSharedValue(6);
  const h2 = useSharedValue(10);
  const h3 = useSharedValue(7);

  useEffect(() => {
    if (!active) {
      cancelAnimation(h1); cancelAnimation(h2); cancelAnimation(h3);
      h1.value = 6; h2.value = 10; h3.value = 7;
      return;
    }
    const loop = (sv, lo, hi, dur) => {
      sv.value = withRepeat(
        withSequence(
          withTiming(hi, { duration: dur, easing: Easing.inOut(Easing.quad) }),
          withTiming(lo, { duration: dur, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    };
    loop(h1, 3, 12, 380);
    loop(h2, 4, 14, 460);
    loop(h3, 3, 11, 420);
    return () => {
      cancelAnimation(h1); cancelAnimation(h2); cancelAnimation(h3);
    };
  }, [active]);

  const s1 = useAnimatedStyle(() => ({ height: h1.value }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value }));

  const Bar = ({ animatedStyle }) => (
    <Animated.View
      style={[
        { width: dim, borderRadius: dim, backgroundColor: '#fff' },
        animatedStyle,
      ]}
    />
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 }}>
      <Bar animatedStyle={s1} />
      <Bar animatedStyle={s2} />
      <Bar animatedStyle={s3} />
    </View>
  );
}
