import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Inline reply box at the bottom of the story viewer.
 *
 * Props:
 *   ownerName        – placeholder text, e.g. "Reply to Sara…"
 *   onSubmit(text)   – async callback that sends the reply
 *   onFocus / onBlur – let the parent pause/resume the story while typing
 */
export default function StoryReplyInput({ ownerName, onSubmit, onFocus, onBlur }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const inputRef = useRef(null);

  const canSend = !!text.trim() && !sending;

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await onSubmit?.(value);
      setText('');
      setSentFlash(true);
      setTimeout(() => setSentFlash(false), 1800);
      Keyboard.dismiss();
    } catch (_) {
      // parent shows the error
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={{ paddingHorizontal: 14 }}>
        {sentFlash ? (
          <View style={{
            alignSelf: 'center',
            backgroundColor: 'rgba(34,197,94,0.95)',
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            marginBottom: 8,
          }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              ✓ Sent
            </Text>
          </View>
        ) : null}

        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.12)',
          borderRadius: 999,
          paddingLeft: 16, paddingRight: 6, paddingVertical: 4,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        }}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={ownerName ? `Reply to ${ownerName}…` : 'Send a message…'}
            placeholderTextColor="rgba(255,255,255,0.55)"
            style={{
              flex: 1, color: '#fff', fontSize: 14,
              paddingVertical: Platform.OS === 'ios' ? 10 : 6,
            }}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            hitSlop={6}
            style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: canSend ? '#ffc801' : 'rgba(255,255,255,0.18)',
              marginLeft: 4,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons
                name="paper-plane"
                size={16}
                color={canSend ? '#000' : 'rgba(255,255,255,0.5)'}
              />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
