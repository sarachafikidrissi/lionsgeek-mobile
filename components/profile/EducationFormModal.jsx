import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1950;

function buildYearOptions() {
  const years = [];
  for (let y = CURRENT_YEAR; y >= MIN_YEAR; y -= 1) years.push(y);
  return years;
}

const YEAR_OPTIONS = buildYearOptions();

function FormLabel({ icon, text, isDark }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Ionicons
        name={icon}
        size={13}
        color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
        style={{ marginRight: 5 }}
      />
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function InputCard({ label, icon, children, isDark }) {
  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 14,
        padding: 13,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      <FormLabel icon={icon} text={label} isDark={isDark} />
      {children}
    </View>
  );
}

function StyledTextInput({ value, onChangeText, placeholder, multiline, keyboardType, isDark }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
      multiline={multiline}
      keyboardType={keyboardType ?? 'default'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        fontSize: 14,
        color: isDark ? '#fff' : '#1a1a1a',
        minHeight: multiline ? 80 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
        borderBottomWidth: 1,
        borderBottomColor: focused ? '#ffc801' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        paddingBottom: 4,
      }}
    />
  );
}

function MonthPicker({ label, icon, value, onChange, isDark, disabled }) {
  return (
    <InputCard label={label} icon={icon} isDark={isDark}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, opacity: disabled ? 0.5 : 1 }}>
        {MONTHS.map((m) => {
          const active = value === m.value;
          return (
            <TouchableOpacity
              key={m.value}
              onPress={() => onChange(active ? null : m.value)}
              disabled={!!disabled}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: active ? '#ffc801' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                borderColor: active ? '#ffc801' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? '700' : '500',
                  color: active ? '#212529' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)',
                }}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </InputCard>
  );
}

function YearPicker({ label, icon, value, onChange, isDark, disabled }) {
  const selected = value ? Number(value) : null;
  return (
    <InputCard label={label} icon={icon} isDark={isDark}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingTop: 4, paddingBottom: 2, opacity: disabled ? 0.5 : 1 }}
      >
        {YEAR_OPTIONS.map((year) => {
          const active = selected === year;
          return (
            <TouchableOpacity
              key={year}
              onPress={() => onChange(active ? '' : String(year))}
              disabled={!!disabled}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? '#ffc801' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                borderColor: active ? '#ffc801' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
                  color: active ? '#212529' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                }}
              >
                {year}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </InputCard>
  );
}

/**
 * Add / Edit education modal.
 *
 * Props:
 *  - visible: bool
 *  - education: object | null
 *  - token: string
 *  - isDark: bool
 *  - onClose: () => void
 *  - onSaved: (education: object) => void
 *  - onDeleted: (id: number|string) => void
 */
export default function EducationFormModal({
  visible,
  education,
  token,
  isDark,
  onClose,
  onSaved,
  onDeleted,
}) {
  const insets = useSafeAreaInsets();
  const isEditMode = !!education;

  const [institution, setInstitution] = useState('');
  const [degree, setDegree] = useState('');
  const [field, setField] = useState('');
  const [startMonth, setStartMonth] = useState(null);
  const [startYear, setStartYear] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [endMonth, setEndMonth] = useState(null);
  const [endYear, setEndYear] = useState('');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && isEditMode) {
      setInstitution(education?.institution ?? education?.school ?? education?.university ?? education?.college ?? '');
      setDegree(education?.degree ?? education?.diploma ?? education?.level ?? '');
      setField(education?.field ?? education?.field_of_study ?? education?.specialization ?? education?.major ?? '');
      setStartMonth(education?.start_month ?? education?.startMonth ?? null);
      setStartYear(String(education?.start_year ?? education?.startYear ?? ''));

      const hasEnd = !!(education?.end_date ?? education?.to ?? education?.ended_at ?? education?.end_year ?? education?.endYear);
      const current = education?.is_current ?? education?.current ?? (!hasEnd);
      setIsCurrent(!!current);

      setEndMonth(education?.end_month ?? education?.endMonth ?? null);
      setEndYear(String(education?.end_year ?? education?.endYear ?? ''));

      const rawDesc = education?.description ?? education?.activities ?? education?.notes ?? '';
      setDescription(typeof rawDesc === 'string' ? rawDesc.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '');
    } else if (visible && !isEditMode) {
      setInstitution('');
      setDegree('');
      setField('');
      setStartMonth(null);
      setStartYear('');
      setIsCurrent(false);
      setEndMonth(null);
      setEndYear('');
      setDescription('');
    }
  }, [visible, isEditMode, education]);

  useEffect(() => {
    if (!visible) return;
    if (isCurrent) {
      setEndMonth(null);
      setEndYear('');
    }
  }, [isCurrent, visible]);

  const validate = () => {
    if (!institution.trim()) {
      Alert.alert('Required', 'Please enter a school / institution.');
      return false;
    }
    if (startMonth == null) {
      Alert.alert('Required', 'Please select a start month.');
      return false;
    }
    if (!startYear) {
      Alert.alert('Required', 'Please select a start year.');
      return false;
    }
    if (startYear && (isNaN(Number(startYear)) || Number(startYear) < MIN_YEAR || Number(startYear) > CURRENT_YEAR)) {
      Alert.alert('Invalid year', `Start year must be between ${MIN_YEAR} and ${CURRENT_YEAR}.`);
      return false;
    }
    if (!isCurrent) {
      if (endMonth == null) {
        Alert.alert('Required', 'Please select an end month.');
        return false;
      }
      if (!endYear) {
        Alert.alert('Required', 'Please select an end year.');
        return false;
      }
      if (endYear && (isNaN(Number(endYear)) || Number(endYear) < MIN_YEAR || Number(endYear) > CURRENT_YEAR)) {
        Alert.alert('Invalid year', `End year must be between ${MIN_YEAR} and ${CURRENT_YEAR}.`);
        return false;
      }
      const sy = Number(startYear);
      const ey = Number(endYear);
      const sm = Number(startMonth);
      const em = Number(endMonth);
      if (ey < sy) {
        Alert.alert('Invalid date', 'End year cannot be before start year.');
        return false;
      }
      if (ey === sy && em < sm) {
        Alert.alert('Invalid date', 'End month cannot be before start month (in the same year).');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const payload = {
        institution: institution.trim(),
        degree: degree.trim() || undefined,
        field: field.trim() || undefined,
        start_month: startMonth ?? undefined,
        start_year: startYear ? Number(startYear) : undefined,
        is_current: isCurrent,
        end_month: isCurrent ? undefined : (endMonth ?? undefined),
        end_year: isCurrent ? undefined : (endYear ? Number(endYear) : undefined),
        description: description.trim() || undefined,
      };

      let saved;
      if (isEditMode) {
        try {
          const res = await API.put(
            `mobile/profile/education/${education.id}`,
            token,
            payload,
          );
          saved = res?.data?.data ?? res?.data ?? { ...education, ...payload };
        } catch (_putErr) {
          const res = await API.postWithAuth(
            `mobile/profile/education/${education.id}`,
            { ...payload, _method: 'PUT' },
            token,
          );
          saved = res?.data?.data ?? res?.data ?? { ...education, ...payload };
        }
      } else {
        const createEndpoints = [
          'mobile/profile/education',
          'mobile/profile/educations',
          'mobile/education',
          'mobile/educations',
        ];

        let lastError = null;
        for (const endpoint of createEndpoints) {
          try {
            const res = await API.postWithAuth(endpoint, payload, token);
            saved = res?.data?.data ?? res?.data ?? payload;
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            if (err?.response?.status !== 404) break;
          }
        }
        if (lastError) throw lastError;
      }

      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('[EDUCATION_FORM] save error:', err);
      const status = err?.response?.status;
      if (status === 404) {
        Alert.alert(
          'API route not found (404)',
          'The app could not find the Education endpoint on the server. Please check your backend routes for the mobile education create endpoint.'
        );
      } else {
        Alert.alert('Error', 'Could not save education. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Education',
      'Are you sure you want to remove this education entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const deleteEndpoints = [
                `mobile/profile/education/${education.id}`,
                `mobile/profile/educations/${education.id}`,
                `mobile/education/${education.id}`,
                `mobile/educations/${education.id}`,
              ];

              let lastError = null;
              for (const endpoint of deleteEndpoints) {
                try {
                  await API.remove(endpoint, token);
                  lastError = null;
                  break;
                } catch (err) {
                  lastError = err;
                  if (err?.response?.status !== 404) break;
                }
              }
              if (lastError) throw lastError;

              onDeleted?.(education.id);
              onClose();
            } catch (err) {
              console.error('[EDUCATION_FORM] delete error:', err);
              const status = err?.response?.status;
              if (status === 404) {
                Alert.alert(
                  'API route not found (404)',
                  'The app could not find the Education delete endpoint on the server. Please check your backend routes for the mobile education delete endpoint.'
                );
              } else {
                Alert.alert('Error', 'Could not delete education. Please try again.');
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const bg = isDark ? '#171717' : '#f4f4f5';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: insets.top + 14,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
            backgroundColor: bg,
          }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: 'rgba(255,200,1,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="school" size={14} color="#ffc801" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#fff' : '#1a1a1a' }}>
              {isEditMode ? 'Edit Education' : 'Add Education'}
            </Text>
          </View>

          {isEditMode ? (
            <TouchableOpacity onPress={handleDelete} hitSlop={12} activeOpacity={0.7} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Ionicons name="trash-outline" size={22} color="#ef4444" />}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <InputCard label="School / Institution *" icon="school-outline" isDark={isDark}>
            <StyledTextInput
              value={institution}
              onChangeText={setInstitution}
              placeholder="e.g. University of ..."
              isDark={isDark}
            />
          </InputCard>

          <InputCard label="Degree" icon="ribbon-outline" isDark={isDark}>
            <StyledTextInput value={degree} onChangeText={setDegree} placeholder="e.g. Bachelor's" isDark={isDark} />
          </InputCard>

          <InputCard label="Field of Study" icon="book-outline" isDark={isDark}>
            <StyledTextInput value={field} onChangeText={setField} placeholder="e.g. Computer Science" isDark={isDark} />
          </InputCard>

          <MonthPicker
            label="Start Month"
            icon="calendar-outline"
            value={startMonth}
            onChange={setStartMonth}
            isDark={isDark}
          />
          <YearPicker
            label="Start Year"
            icon="calendar-number-outline"
            value={startYear}
            onChange={setStartYear}
            isDark={isDark}
          />

          <TouchableOpacity
            onPress={() => setIsCurrent((prev) => !prev)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isCurrent ? 'rgba(255,200,1,0.1)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1.5,
              borderColor: isCurrent ? '#ffc801' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons
                name={isCurrent ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isCurrent ? '#ffc801' : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              />
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#fff' : '#1a1a1a' }}>
                  I currently study here
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', marginTop: 1 }}>
                  End date will show as &quot;Present&quot;
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: isCurrent ? '#ffc801' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  alignSelf: isCurrent ? 'flex-end' : 'flex-start',
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              />
            </View>
          </TouchableOpacity>

          {!isCurrent && (
            <>
              <MonthPicker
                label="End Month"
                icon="calendar-outline"
                value={endMonth}
                onChange={setEndMonth}
                isDark={isDark}
              />
              <YearPicker
                label="End Year"
                icon="calendar-number-outline"
                value={endYear}
                onChange={setEndYear}
                isDark={isDark}
              />
            </>
          )}

          <InputCard label="Description" icon="document-text-outline" isDark={isDark}>
            <StyledTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Optional details (activities, notes, achievements)…"
              multiline
              isDark={isDark}
            />
          </InputCard>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => ({
              backgroundColor: '#ffc801',
              borderRadius: 16,
              paddingVertical: 15,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              marginTop: 8,
              opacity: pressed || saving ? 0.75 : 1,
              shadowColor: '#ffc801',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 6,
            })}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#212529" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#212529" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#212529' }}>
                  {isEditMode ? 'Save Changes' : 'Add Education'}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

