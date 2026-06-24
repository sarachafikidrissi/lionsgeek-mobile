import { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View, InteractionManager, Text, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

const ICON_MS = 1200;
const TYPE_CHAR_MS = 78;
const TITLE_HOLD_MS = 560;
const LOADER_APPEAR_MS = 280;
const LOADER_HINT = 'Applying theme…';
const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const ICON_TRAVEL = 64;

const THEME_BG = {
  light: Colors.light,
  dark: '#0D0C0B',
};

const MODE_LABELS = {
  dark: 'Coding Mode',
  light: 'Media Mode',
};

const SUN_COLOR = '#F5C518';
const MOON_COLOR = '#E8ECF4';
const ICON_SUN = 88;
const ICON_MOON = 72;

const STARS = [
  { top: 0.12, left: 0.18, size: 3, o: 0.5 },
  { top: 0.08, left: 0.72, size: 2, o: 0.4 },
  { top: 0.22, left: 0.85, size: 3, o: 0.6 },
  { top: 0.18, left: 0.42, size: 2, o: 0.35 },
  { top: 0.28, left: 0.08, size: 2, o: 0.45 },
  { top: 0.15, left: 0.55, size: 3, o: 0.55 },
];

function ThemeTransitionOverlay({ colorScheme, onApplyTheme }, ref) {
  const { width, height } = useWindowDimensions();
  const colorSchemeRef = useRef(colorScheme);
  const holdTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const onApplyThemeRef = useRef(onApplyTheme);

  const [visible, setVisible] = useState(false);
  const [backdrop, setBackdrop] = useState(THEME_BG.dark);
  const [showStars, setShowStars] = useState(false);
  const [titleOnDark, setTitleOnDark] = useState(true);
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  const iconProgress = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const loaderOpacity = useSharedValue(0);
  const loaderScale = useSharedValue(0.88);
  const goingDark = useSharedValue(1);

  useEffect(() => {
    colorSchemeRef.current = colorScheme;
  }, [colorScheme]);

  useEffect(() => {
    onApplyThemeRef.current = onApplyTheme;
  }, [onApplyTheme]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    iconProgress.value = 0;
    titleOpacity.value = 0;
    loaderOpacity.value = 0;
    loaderScale.value = 0.88;
    setVisible(false);
    setShowStars(false);
    setTypedText('');
    setShowCursor(false);
    setShowLoader(false);
  }, [clearTimers, iconProgress, loaderOpacity, loaderScale, titleOpacity]);

  const applyThemeAndDismiss = useCallback(
    (nextTheme) => {
      const apply = onApplyThemeRef.current;
      if (typeof apply === 'function') {
        apply(nextTheme);
      }
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          dismiss();
        });
      });
    },
    [dismiss],
  );

  const scheduleApplyTheme = useCallback(
    (nextTheme) => {
      clearTimers();
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        applyThemeAndDismiss(nextTheme);
      }, TITLE_HOLD_MS);
    },
    [applyThemeAndDismiss, clearTimers],
  );

  const revealLoaderThenFinish = useCallback(
    (nextTheme) => {
      setShowLoader(true);
      loaderOpacity.value = 0;
      loaderScale.value = 0.88;
      loaderOpacity.value = withTiming(1, { duration: LOADER_APPEAR_MS, easing: EASE });
      loaderScale.value = withTiming(1, { duration: LOADER_APPEAR_MS, easing: EASE }, (done) => {
        'worklet';
        if (done) {
          runOnJS(scheduleApplyTheme)(nextTheme);
        }
      });
    },
    [loaderOpacity, loaderScale, scheduleApplyTheme],
  );

  const startTypewriter = useCallback(
    (fullLabel, nextTheme) => {
      setTypedText('');
      setShowCursor(true);
      setShowLoader(false);
      loaderOpacity.value = 0;
      titleOpacity.value = withTiming(1, { duration: 80, easing: EASE });

      let index = 0;
      const tick = () => {
        index += 1;
        setTypedText(fullLabel.slice(0, index));
        if (index >= fullLabel.length) {
          setShowCursor(false);
          revealLoaderThenFinish(nextTheme);
          return;
        }
        typingTimerRef.current = setTimeout(tick, TYPE_CHAR_MS);
      };

      typingTimerRef.current = setTimeout(tick, TYPE_CHAR_MS);
    },
    [revealLoaderThenFinish, titleOpacity, loaderOpacity],
  );

  const onIconsComplete = useCallback(
    (nextTheme, isDarkTransition) => {
      const label = isDarkTransition ? MODE_LABELS.dark : MODE_LABELS.light;
      startTypewriter(label, nextTheme);
    },
    [startTypewriter],
  );

  const startSequence = useCallback(
    (nextTheme, isDarkTransition) => {
      const bg = isDarkTransition ? THEME_BG.dark : THEME_BG.light;
      goingDark.value = isDarkTransition ? 1 : 0;
      setBackdrop(bg);
      setShowStars(isDarkTransition);
      setTitleOnDark(isDarkTransition);
      setTypedText('');
      setShowCursor(false);
      setShowLoader(false);
      iconProgress.value = 0;
      titleOpacity.value = 0;
      loaderOpacity.value = 0;
      setVisible(true);

      iconProgress.value = withTiming(1, { duration: ICON_MS, easing: EASE }, (finished) => {
        'worklet';
        if (!finished) {
          runOnJS(dismiss)();
          return;
        }
        runOnJS(onIconsComplete)(nextTheme, isDarkTransition);
      });
    },
    [dismiss, goingDark, iconProgress, loaderOpacity, onIconsComplete, titleOpacity],
  );

  useImperativeHandle(
    ref,
    () => ({
      animate(nextTheme) {
        if (nextTheme !== 'dark' && nextTheme !== 'light') return;
        if (nextTheme === colorSchemeRef.current) return;
        startSequence(nextTheme, nextTheme === 'dark');
      },
    }),
    [startSequence],
  );

  const sunStyle = useAnimatedStyle(() => {
    if (goingDark.value === 1) {
      const y = interpolate(iconProgress.value, [0, 1], [-ICON_TRAVEL * 0.5, ICON_TRAVEL]);
      const opacity = interpolate(iconProgress.value, [0, 0.7, 1], [1, 0.55, 0]);
      return { transform: [{ translateY: y }], opacity };
    }
    const y = interpolate(iconProgress.value, [0, 1], [ICON_TRAVEL, -ICON_TRAVEL * 0.35]);
    const opacity = interpolate(iconProgress.value, [0, 0.35, 1], [0, 0.6, 1]);
    return { transform: [{ translateY: y }], opacity };
  });

  const moonStyle = useAnimatedStyle(() => {
    if (goingDark.value === 1) {
      const y = interpolate(iconProgress.value, [0, 1], [ICON_TRAVEL, -ICON_TRAVEL * 0.35]);
      const opacity = interpolate(iconProgress.value, [0, 0.35, 1], [0, 0.65, 1]);
      return { transform: [{ translateY: y }], opacity };
    }
    const y = interpolate(iconProgress.value, [0, 1], [-ICON_TRAVEL * 0.35, ICON_TRAVEL]);
    const opacity = interpolate(iconProgress.value, [0, 0.7, 1], [1, 0.5, 0]);
    return { transform: [{ translateY: y }], opacity };
  });

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const loaderStyle = useAnimatedStyle(() => ({
    opacity: loaderOpacity.value,
    transform: [{ scale: loaderScale.value }],
  }));

  const loaderColor = titleOnDark ? SUN_COLOR : Colors.beta;
  const hintColor = titleOnDark ? 'rgba(250,250,250,0.65)' : 'rgba(33,37,41,0.55)';

  if (!visible) return null;

  return (
    <View
      pointerEvents="auto"
      style={[styles.overlay, { width, height, backgroundColor: backdrop }]}
    >
      {showStars ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {STARS.map((s, i) => (
            <View
              key={i}
              style={[
                styles.star,
                {
                  top: s.top * height,
                  left: s.left * width,
                  width: s.size,
                  height: s.size,
                  borderRadius: s.size / 2,
                  opacity: 0.15 + s.o * 0.55,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.centerStage}>
        <View style={styles.iconStage}>
          <Animated.View style={[styles.iconCenter, sunStyle]}>
            <Ionicons name="sunny" size={ICON_SUN} color={SUN_COLOR} />
          </Animated.View>
          <Animated.View style={[styles.iconCenter, moonStyle]}>
            <Ionicons name="moon" size={ICON_MOON} color={MOON_COLOR} />
          </Animated.View>
        </View>

        <Animated.View pointerEvents="none" style={[styles.titleWrap, titleStyle]}>
          <Text style={[styles.title, titleOnDark ? styles.titleOnDark : styles.titleOnLight]}>
            {typedText}
            {showCursor ? (
              <Text style={[styles.cursor, titleOnDark ? styles.titleOnDark : styles.titleOnLight]}>|</Text>
            ) : null}
          </Text>
        </Animated.View>

        {showLoader ? (
          <Animated.View pointerEvents="none" style={[styles.loaderWrap, loaderStyle]}>
            <ActivityIndicator size="small" color={loaderColor} />
            <Text style={[styles.loaderHint, { color: hintColor }]}>{LOADER_HINT}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999999,
    elevation: 999999,
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconStage: {
    width: 120,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#fff',
  },
  titleWrap: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  cursor: {
    fontWeight: '300',
    opacity: 0.85,
  },
  titleOnDark: {
    color: '#fafafa',
  },
  titleOnLight: {
    color: Colors.beta,
  },
  loaderWrap: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  loaderHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
});

export default forwardRef(ThemeTransitionOverlay);
