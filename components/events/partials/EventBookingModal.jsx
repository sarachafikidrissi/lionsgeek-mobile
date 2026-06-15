import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EventsInfoAPI from '@/api/eventsInfoSection';
import {
  buildInitialAnswers,
  extractBookingErrorMessage,
  getBookingFields,
  getFieldLabel,
  getOptionLabel,
  normalizeBookingKey,
  validateBookingAnswers,
} from '@/components/events/bookingHelpers';
import { getEventDisplayName } from '@/components/events/helpers';
import { Colors, getAccentFillColor, getOnAccentTextColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const PLACEHOLDERS = {
  name: 'Enter your name',
  email: 'Enter your email',
  phone: 'Enter phone number',
};

function FieldLabel({ field, language }) {
  return (
    <Text className="text-sm font-semibold text-beta dark:text-light mb-1.5">
      {getFieldLabel(field, language)}
      {field?.required ? <Text className="text-error"> *</Text> : null}
    </Text>
  );
}

function FieldError({ message }) {
  if (!message) return null;
  return <Text className="text-xs text-error mt-1">{message}</Text>;
}

export default function EventBookingModal({ visible, event, user, onClose, onSuccess }) {
  const isDark = useColorScheme() === 'dark';
  const accentFill = getAccentFillColor(isDark);
  const onAccentText = getOnAccentTextColor(isDark);
  const language = 'en';

  const fields = useMemo(() => getBookingFields(event), [event]);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setAnswers(buildInitialAnswers(fields, user));
    setErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setSubmitting(false);
  }, [visible, event?.id, fields, user]);

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleDone = () => {
    onClose?.();
  };

  const updateAnswer = (key, value) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  const toggleSelectValue = (field, optionValue) => {
    const key = field.key;
    const normalizedKey = normalizeBookingKey(key);
    const isGender = normalizedKey === 'gender';

    if (isGender) {
      const current = Array.isArray(answers[key]) ? answers[key] : [];
      const next = current.includes(optionValue) ? [] : [optionValue];
      updateAnswer(key, next);
      return;
    }

    if (field.multiple === false) {
      const current = typeof answers[key] === 'string' ? answers[key] : null;
      updateAnswer(key, current === optionValue ? null : optionValue);
      return;
    }

    const current = Array.isArray(answers[key]) ? answers[key] : [];
    const next = current.includes(optionValue)
      ? current.filter((value) => value !== optionValue)
      : [...current, optionValue];
    updateAnswer(key, next);
  };

  const handleSubmit = async () => {
    const validationErrors = validateBookingAnswers(fields, answers);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const response = await EventsInfoAPI.storeBooking({
        event_id: event?.id,
        answers,
      });

      const message =
        response?.data?.message?.en ||
        response?.data?.message ||
        'Booking successful! You will receive a confirmation email.';

      setSuccessMessage(typeof message === 'string' ? message : 'Booking successful!');
      onSuccess?.(response?.data);
    } catch (error) {
      const serverErrors = error?.response?.data?.errors;
      if (serverErrors && typeof serverErrors === 'object') {
        const mapped = {};
        Object.entries(serverErrors).forEach(([key, value]) => {
          const fieldKey = key.replace(/^answers\./, '');
          mapped[fieldKey] = Array.isArray(value) ? value[0] : String(value);
        });
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
        }
      }
      setFormError(extractBookingErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const renderTextField = (field) => {
    const key = field.key;
    const normalizedKey = normalizeBookingKey(key);
    const keyboardType = field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default';

    return (
      <View key={key} className="mb-4">
        <FieldLabel field={field} language={language} />
        <TextInput
          value={answers[key] ?? ''}
          onChangeText={(value) => updateAnswer(key, value)}
          placeholder={PLACEHOLDERS[normalizedKey] || ''}
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
          keyboardType={keyboardType}
          autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
          autoCorrect={false}
          className="min-h-12 rounded-2xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark px-4 py-3 text-sm text-beta dark:text-light"
        />
        <FieldError message={errors[key]} />
      </View>
    );
  };

  const renderSelectField = (field) => {
    const key = field.key;
    const normalizedKey = normalizeBookingKey(key);
    const isGender = normalizedKey === 'gender';
    const options = Array.isArray(field.options) ? field.options : [];
    const selectedValues = Array.isArray(answers[key]) ? answers[key] : [];
    const selectedSingleValue = typeof answers[key] === 'string' ? answers[key] : null;
    const multiple = field.multiple !== false && !isGender;

    if (isGender) {
      return (
        <View key={key} className="mb-4">
          <FieldLabel field={field} language={language} />
          <View className="flex-row gap-2">
            {options.map((option) => {
              const optionValue = option?.value ?? '';
              const active = selectedValues.includes(optionValue);
              return (
                <Pressable
                  key={optionValue}
                  onPress={() => toggleSelectValue(field, optionValue)}
                  className={`flex-1 items-center justify-center rounded-2xl border px-4 py-3 ${
                    active
                      ? 'bg-beta dark:bg-alpha border-transparent'
                      : 'border-beta/10 dark:border-light/10 bg-beta/5 dark:bg-light/5'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      active ? 'text-light dark:text-beta' : 'text-beta dark:text-light'
                    }`}
                  >
                    {getOptionLabel(option, language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <FieldError message={errors[key]} />
        </View>
      );
    }

    return (
      <View key={key} className="mb-4">
        <FieldLabel field={field} language={language} />
        <View className="rounded-2xl border border-beta/10 dark:border-light/10 overflow-hidden">
          {options.map((option, index) => {
            const optionValue = option?.value ?? '';
            const checked = multiple
              ? selectedValues.includes(optionValue)
              : selectedSingleValue === optionValue;

            return (
              <Pressable
                key={optionValue}
                onPress={() => toggleSelectValue(field, optionValue)}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  index > 0 ? 'border-t border-beta/10 dark:border-light/10' : ''
                } ${checked ? 'bg-beta/8 dark:bg-alpha/10' : ''}`}
              >
                <Text className="text-sm text-beta dark:text-light flex-1 pr-3">
                  {getOptionLabel(option, language)}
                </Text>
                <Ionicons
                  name={multiple ? (checked ? 'checkbox' : 'square-outline') : checked ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={checked ? accentFill : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                />
              </Pressable>
            );
          })}
        </View>
        <FieldError message={errors[key]} />
      </View>
    );
  };

  const eventTitle = getEventDisplayName(event?.name);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            zIndex: 1,
          }}
          onPress={handleClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '88%',
            backgroundColor: isDark ? Colors.dark : Colors.light,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
            zIndex: 2,
            elevation: 2,
          }}
        >
          <View className="items-center pt-3 pb-2">
            <View className="w-9 h-1 rounded-full bg-beta/20 dark:bg-light/20" />
          </View>

          <View className="px-5 pb-3 flex-row items-start justify-between gap-3 border-b border-beta/10 dark:border-light/10">
            <View className="flex-1 min-w-0">
              <Text className="text-xl font-bold text-beta dark:text-light">Book Event</Text>
              <Text className="text-sm text-beta/60 dark:text-light/60 mt-1" numberOfLines={2}>
                {eventTitle}
              </Text>
              <Text className="text-xs text-beta/50 dark:text-light/50 mt-1">
                Enter your details to book this event. You will receive a confirmation email.
              </Text>
            </View>
            <Pressable
              onPress={successMessage ? handleDone : handleClose}
              className="w-10 h-10 rounded-2xl bg-beta/10 dark:bg-light/10 items-center justify-center"
            >
              <Ionicons name="close" size={22} color={isDark ? Colors.light : Colors.beta} />
            </Pressable>
          </View>

          {successMessage ? (
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-16 h-16 rounded-full bg-good/15 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={40} color={Colors.good} />
              </View>
              <Text className="text-lg font-bold text-beta dark:text-light text-center">Booking Confirmed!</Text>
              <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-2">{successMessage}</Text>
              <Pressable
                onPress={handleDone}
                className="mt-6 bg-beta dark:bg-alpha px-6 py-3.5 rounded-2xl active:opacity-90"
              >
                <Text className="text-light dark:text-beta font-bold">Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView
                className="flex-1 px-5 pt-4"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                {formError ? (
                  <View className="mb-4 rounded-2xl border border-error/30 bg-error/10 px-4 py-3">
                    <Text className="text-sm text-error">{formError}</Text>
                  </View>
                ) : null}

                {fields.map((field) => {
                  if (field.type === 'select') return renderSelectField(field);
                  return renderTextField(field);
                })}
              </ScrollView>

              <View className="px-5 py-4 border-t border-beta/10 dark:border-light/10 flex-row gap-3">
                <Pressable
                  onPress={handleClose}
                  disabled={submitting}
                  className="flex-1 items-center justify-center rounded-2xl border border-beta/10 dark:border-light/10 py-3.5 active:opacity-80"
                >
                  <Text className="text-sm font-semibold text-beta dark:text-light">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting}
                  className={`flex-1 items-center justify-center rounded-2xl py-3.5 ${
                    submitting ? 'bg-beta/50 dark:bg-alpha/50' : 'bg-beta dark:bg-alpha active:opacity-90'
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator color={onAccentText} />
                  ) : (
                    <Text className="text-sm font-bold text-light dark:text-beta">Book Event</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
