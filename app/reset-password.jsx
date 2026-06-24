import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import { Input, Button } from '@/components/ui';

const MIN_NEW = 8;

function firstErrorMessage(errors) {
  if (!errors || typeof errors !== 'object') return null;
  const keys = Object.keys(errors);
  if (!keys.length) return null;
  const first = errors[keys[0]];
  if (Array.isArray(first) && first[0]) return String(first[0]);
  if (typeof first === 'string') return first;
  return null;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { token } = useAppContext();

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const canSave = useMemo(() => {
    if (!currentPassword.trim() || !password.trim() || !passwordConfirmation.trim()) return false;
    if (password.length < MIN_NEW) return false;
    if (password !== passwordConfirmation) return false;
    return true;
  }, [currentPassword, password, passwordConfirmation]);

  const save = useCallback(async () => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }
    if (!canSave) return;
    setFormError('');
    setSubmitting(true);
    try {
      await API.postWithAuth(
        'mobile/password',
        {
          current_password: currentPassword,
          password,
          password_confirmation: passwordConfirmation,
        },
        token,
      );
      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (e) {
      const data = e?.response?.data;
      const msg =
        firstErrorMessage(data?.errors) ||
        (typeof data?.message === 'string' ? data.message : null) ||
        'Could not update password. Please try again.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [token, canSave, currentPassword, password, passwordConfirmation, router]);

  if (!token) {
    return (
      <View className={`flex-1 items-center justify-center px-6 ${isDark ? 'bg-dark' : 'bg-light'}`}>
        <Text className="text-center text-base font-semibold text-black dark:text-white">Sign in required</Text>
        <Text className="mt-2 text-center text-sm text-black/60 dark:text-white/60">
          You need to be logged in to change your password.
        </Text>
        <Pressable onPress={() => router.replace('/auth/login')} className="mt-6">
          <Text className="text-base font-bold text-alpha">Go to login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Account security
        </Text>
        <Text className="mt-2 text-2xl font-bold text-black dark:text-white">Reset password</Text>
        <Text className="mt-2 text-sm leading-5 text-gray-600 dark:text-gray-400">
          Enter your current password, then choose a new one. Your new password must be at least {MIN_NEW}{' '}
          characters and match the confirmation field.
        </Text>

        <View className="mt-8">
          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
          />
          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${MIN_NEW} characters`}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <Input
            label="Confirm new password"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            placeholder="Repeat new password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
        </View>

        {!!formError && (
          <Text className="mb-2 text-sm font-medium text-red-500 dark:text-red-400">{formError}</Text>
        )}

        <Button onPress={save} disabled={!canSave || submitting} loading={submitting}>
          Save new password
        </Button>

        <Pressable
          onPress={() => router.push('/auth/forgot-password')}
          className="mt-6 items-center py-2"
          hitSlop={12}
        >
          <Text className="text-center text-sm font-semibold text-alpha underline">
            Forgot password?
          </Text>
        </Pressable>
        <Text className="mt-1 text-center text-xs text-gray-500 dark:text-gray-500">
          We will email you a link to reset without your current password.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
