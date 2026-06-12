import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Full-screen text-input modal used by the story editor.
 *
 * Behaviour:
 *  - Opens with a dimmed overlay over the media.
 *  - Auto-focuses the text input at center.
 *  - User can pick a color from a horizontal scroll row.
 *  - Toggle background pill on/off (Instagram-style).
 *  - "Done" returns { text, color, has_bg, bg_color }.
 *
 * Props:
 *   visible   – open/close
 *   initial   – optional, when editing an existing overlay:
 *                 { text, color, has_bg, bg_color }
 *   onCancel  – close without saving
 *   onSubmit  – { text, color, has_bg, bg_color } → parent
 */
const COLORS = [
  '#ffffff', '#000000',
  '#ffc801', '#ef4444', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899',
  '#f97316', '#06b6d4', '#a3a3a3',
];

export default function TextInputModal({ visible, initial, onCancel, onSubmit }) {
  const [text, setText] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [hasBg, setHasBg] = useState(false);
  const inputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setText(initial?.text ?? '');
      setColor(initial?.color ?? '#ffffff');
      setHasBg(!!initial?.has_bg);
      // Slight delay so keyboard pops smoothly.
      setTimeout(() => inputRef.current?.focus?.(), 80);
    }
  }, [visible, initial]);

  const handleDone = () => {
    const value = text.trim();
    if (!value) {
      onCancel && onCancel();
      return;
    }
    onSubmit?.({
      text: value,
      color,
      has_bg: hasBg,
      bg_color: hasBg ? color : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            {/* Top bar */}
            <View style={{
              paddingTop: Platform.OS === 'ios' ? 54 : 28,
              paddingHorizontal: 16, paddingBottom: 8,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Pressable
                onPress={() => setHasBg((b) => !b)}
                hitSlop={10}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: hasBg ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.18)',
                }}
              >
                <Ionicons
                  name="text-outline"
                  size={16}
                  color={hasBg ? '#000' : '#fff'}
                />
                <Text style={{ color: hasBg ? '#000' : '#fff', fontSize: 12, fontWeight: '700' }}>
                  Highlight
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDone}
                hitSlop={10}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: '#ffc801',
                }}
              >
                <Text style={{ color: '#000', fontWeight: '800' }}>Done</Text>
              </Pressable>
            </View>

            {/* Center: text input */}
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
              <View style={{
                backgroundColor: hasBg ? color : 'transparent',
                paddingHorizontal: hasBg ? 14 : 0,
                paddingVertical: hasBg ? 8 : 0,
                borderRadius: hasBg ? 10 : 0,
                alignSelf: 'center',
                maxWidth: '100%',
              }}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Type something…"
                  placeholderTextColor={hasBg ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.45)'}
                  multiline
                  maxLength={300}
                  textAlign="center"
                  style={{
                    color: hasBg ? pickContrasting(color) : color,
                    fontSize: 30,
                    fontWeight: '800',
                    minWidth: 100,
                    lineHeight: 36,
                  }}
                />
              </View>
            </View>

            {/* Bottom: color row */}
            <View style={{ paddingBottom: Platform.OS === 'ios' ? 30 : 18, paddingTop: 10 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              >
                {COLORS.map((c) => {
                  const isSelected = c.toLowerCase() === color.toLowerCase();
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setColor(c)}
                      hitSlop={4}
                      style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: c,
                        borderWidth: 2,
                        borderColor: isSelected ? '#fff' : 'rgba(255,255,255,0.4)',
                        transform: [{ scale: isSelected ? 1.15 : 1 }],
                      }}
                    />
                  );
                })}
              </ScrollView>

              {/* Cancel link */}
              <Pressable onPress={onCancel} style={{ alignSelf: 'center', marginTop: 12 }} hitSlop={8}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function pickContrasting(hex) {
  if (!hex || typeof hex !== 'string') return '#000';
  const m = hex.replace('#', '');
  if (m.length < 6) return '#000';
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#000';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}
