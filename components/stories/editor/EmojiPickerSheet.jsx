import { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const { height: WINDOW_H } = Dimensions.get('window');
const SHEET_H = Math.round(WINDOW_H * 0.52);

const CATEGORIES = [
  { key: 'smileys',  emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😜','😝','😛','🤑','🤗','🤩','🥳','😎','🤓','🧐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😴','🤤','😪','😵','🤯','🤠','😷','🤒','🤕','🤧','🤮','🤢','😱','😨','😰','😥','😓','🤔','🙊','🙉','🙈'] },
  { key: 'hearts',   emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','🩵','🩶','🩷'] },
  { key: 'symbols',  emojis: ['🔥','✨','⭐','🌟','💫','💥','💯','✅','❌','⚡','🌈','☀️','🌙','☁️','❄️','💧','🎉','🎊','🎁','🏆','🥇','🥈','🥉','🎯','🎮','🎵','🎶','📸','📷','💎','💰','🏠','🚀','✈️','🌍','📚','💡','🔔','🔒','🔓'] },
  { key: 'hands',    emojis: ['👍','👎','👏','🙌','🙏','💪','✊','👌','🤞','✌️','🤟','🤘','🤙','👈','👉','👆','👇','✋','🖐️','🖖','👋','🤚','🫶','🫰','🤝'] },
  { key: 'food',     emojis: ['🍕','🍔','🍟','🌭','🍿','🥨','🥯','🥞','🧇','🥓','🥩','🍗','🍖','🌮','🌯','🥗','🍣','🍱','🍤','🍙','🍚','🍜','🍝','🍰','🎂','🍩','🍪','🍫','🍬','🍭','🍦','🧁','☕','🍵','🍺','🍷','🥂','🍾'] },
];

/**
 * Bottom sheet of emojis grouped into a few tabs. Tapping an emoji adds it
 * as a sticker overlay at the center of the canvas.
 *
 * Props:
 *   visible
 *   onClose
 *   onPick(emoji)
 */
export default function EmojiPickerSheet({ visible, onClose, onPick }) {
  const translateY = useSharedValue(SHEET_H);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      translateY.value = withTiming(SHEET_H, { duration: 200 });
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(15)
    .onUpdate((e) => { if (e.translationY > 0) translateY.value = e.translationY; })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 700) {
        translateY.value = withTiming(SHEET_H, { duration: 200 }, (f) => {
          if (f) runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 180 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.value / SHEET_H) * 0.5,
  }));

  if (!visible && translateY.value === SHEET_H) return null;

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ position: 'absolute', inset: 0, zIndex: 2000, elevation: 2000 }}
    >
      <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      <GestureHandlerRootView
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[{
              height: SHEET_H,
              backgroundColor: '#0d0d0d',
              borderTopLeftRadius: 22, borderTopRightRadius: 22,
              overflow: 'hidden',
            }, sheetStyle]}
          >
            <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
              <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </View>

            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8,
            }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Stickers</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: Platform.OS === 'ios' ? 30 : 18 }}
            >
              {CATEGORIES.map((cat) => (
                <View key={cat.key} style={{ marginTop: 6 }}>
                  <Text style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 11, fontWeight: '700',
                    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4,
                    textTransform: 'uppercase', letterSpacing: 0.6,
                  }}>
                    {cat.key}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {cat.emojis.map((e, i) => (
                      <Pressable
                        key={`${cat.key}-${i}`}
                        onPress={() => { onPick?.(e); onClose?.(); }}
                        style={({ pressed }) => ({
                          width: 44, height: 44,
                          alignItems: 'center', justifyContent: 'center',
                          opacity: pressed ? 0.55 : 1,
                          transform: [{ scale: pressed ? 0.92 : 1 }],
                        })}
                      >
                        <Text style={{ fontSize: 26 }}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}
