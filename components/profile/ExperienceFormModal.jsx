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

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  { value: 1,  label: 'Jan' },
  { value: 2,  label: 'Feb' },
  { value: 3,  label: 'Mar' },
  { value: 4,  label: 'Apr' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'Jun' },
  { value: 7,  label: 'Jul' },
  { value: 8,  label: 'Aug' },
  { value: 9,  label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2000;

function buildYearOptions() {
  const years = [];
  for (let y = CURRENT_YEAR; y >= MIN_YEAR; y -= 1) years.push(y);
  return years;
}

const YEAR_OPTIONS = buildYearOptions();

const EMPLOYMENT_TYPES = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'internship', label: 'Internship' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

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
        paddingVertical: multiline ? 0 : 0,
        minHeight: multiline ? 80 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
        borderBottomWidth: 1,
        borderBottomColor: focused
          ? '#ffc801'
          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        paddingBottom: 4,
      }}
    />
  );
}

function MonthPicker({ label, icon, value, onChange, isDark }) {
  return (
    <InputCard label={label} icon={icon} isDark={isDark}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {MONTHS.map((m) => {
          const active = value === m.value;
          return (
            <TouchableOpacity
              key={m.value}
              onPress={() => onChange(active ? null : m.value)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                borderColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
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
        contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingTop: 4, paddingBottom: 2 }}
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
                backgroundColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                borderColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                opacity: disabled ? 0.45 : 1,
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

function EmploymentTypePicker({ value, onChange, isDark }) {
  return (
    <InputCard label="Employment Type *" icon="options-outline" isDark={isDark}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {EMPLOYMENT_TYPES.map((t) => {
          const active = value === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              onPress={() => onChange(active ? '' : t.value)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                borderColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
                  color: active ? '#212529' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                }}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </InputCard>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

/**
 * Add / Edit experience modal.
 *
 * Props:
 *  - visible: bool
 *  - experience: object | null  (null = create mode, object = edit mode)
 *  - token: string
 *  - isDark: bool
 *  - onClose: () => void
 *  - onSaved: (experience: object) => void   called after successful create/update
 *  - onDeleted: (id: number|string) => void  called after successful delete
 */
export default function ExperienceFormModal({
  visible,
  experience,
  token,
  isDark,
  onClose,
  onSaved,
  onDeleted,
}) {
  const insets = useSafeAreaInsets();
  const isEditMode = !!experience;

  // ── Form state ──
  const [title, setTitle]               = useState('');
  const [company, setCompany]           = useState('');
  const [location, setLocation]         = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [startMonth, setStartMonth]     = useState(null);
  const [startYear, setStartYear]       = useState('');
  const [isCurrent, setIsCurrent]       = useState(false);
  const [endMonth, setEndMonth]         = useState(null);
  const [endYear, setEndYear]           = useState('');
  const [description, setDescription]   = useState('');

  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (visible && isEditMode) {
      setTitle(experience.title ?? experience.position ?? experience.role ?? '');
      setCompany(experience.company ?? experience.company_name ?? experience.organization ?? '');
      setLocation(experience.location ?? experience.city ?? experience.place ?? '');
      const rawEmploymentType = experience.employment_type ?? experience.employement_type ?? experience.employmentType ?? '';
      // Normalize older free-text values into our limited set
      const normalizedEmploymentType = String(rawEmploymentType)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
      setEmploymentType(normalizedEmploymentType);
      setStartMonth(experience.start_month ?? experience.startMonth ?? null);
      setStartYear(String(experience.start_year ?? experience.startYear ?? ''));
      const hasEnd = !!(
        experience.end_date ?? experience.to ?? experience.ended_at ??
        experience.end_year ?? experience.endYear
      );
      const current = experience.is_current ?? experience.current ?? (!hasEnd);
      setIsCurrent(current);
      setEndMonth(experience.end_month ?? experience.endMonth ?? null);
      setEndYear(String(experience.end_year ?? experience.endYear ?? ''));
      const rawDesc =
        experience.description ?? experience.desc ?? experience.summary ??
        experience.details ?? experience.responsibilities ?? experience.body ?? '';
      setDescription(
        typeof rawDesc === 'string'
          ? rawDesc.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
          : ''
      );
    } else if (visible && !isEditMode) {
      // Reset for create mode
      setTitle('');
      setCompany('');
      setLocation('');
      setEmploymentType('');
      setStartMonth(null);
      setStartYear('');
      setIsCurrent(false);
      setEndMonth(null);
      setEndYear('');
      setDescription('');
    }
  }, [visible, isEditMode, experience]);

  // Clear end date parts when toggling to "current"
  useEffect(() => {
    if (!visible) return;
    if (isCurrent) {
      setEndMonth(null);
      setEndYear('');
    }
  }, [isCurrent, visible]);

  // ── Validation ──
  const validate = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a job title or role.');
      return false;
    }
    if (!company.trim()) {
      Alert.alert('Required', 'Please enter a company / organization.');
      return false;
    }
    if (!location.trim()) {
      Alert.alert('Required', 'Please enter a location.');
      return false;
    }
    if (!employmentType.trim()) {
      Alert.alert('Required', 'Please enter an employment type.');
      return false;
    }
    if (!EMPLOYMENT_TYPES.some((t) => t.value === employmentType.trim())) {
      Alert.alert('Invalid value', 'Please select a valid employment type.');
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
    }
    if (!isCurrent && endYear && (isNaN(Number(endYear)) || Number(endYear) < MIN_YEAR || Number(endYear) > CURRENT_YEAR)) {
      Alert.alert('Invalid year', `End year must be between ${MIN_YEAR} and ${CURRENT_YEAR}.`);
      return false;
    }

    // Logical date validation: end date must be >= start date (when both are provided)
    if (!isCurrent) {
      const sy = startYear ? Number(startYear) : null;
      const ey = endYear ? Number(endYear) : null;
      const sm = startMonth != null ? Number(startMonth) : null;
      const em = endMonth != null ? Number(endMonth) : null;

      if (Number.isFinite(sy) && Number.isFinite(ey)) {
        if (ey < sy) {
          Alert.alert('Invalid date', 'End year cannot be before start year.');
          return false;
        }
        if (ey === sy && Number.isFinite(sm) && Number.isFinite(em) && em < sm) {
          Alert.alert('Invalid date', 'End month cannot be before start month (in the same year).');
          return false;
        }
      }
    }
    return true;
  };

  // ── Save ──
  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const payload = {
        title:       title.trim(),
        company:     company.trim(),
        location:    location.trim(),
        employment_type: employmentType.trim(),
        start_month: startMonth ?? undefined,
        start_year:  startYear ? Number(startYear) : undefined,
        is_current:  isCurrent,
        end_month:   isCurrent ? undefined : (endMonth ?? undefined),
        end_year:    isCurrent ? undefined : (endYear ? Number(endYear) : undefined),
        description: description.trim(),
      };

      let saved;
      if (isEditMode) {
        // Try PUT, fall back to POST with _method spoofing (some Laravel setups require this)
        try {
          const res = await API.put(
            `mobile/profile/experiences/${experience.id}`,
            token,
            payload,
          );
          saved = res?.data?.data ?? res?.data ?? { ...experience, ...payload };
        } catch (_putErr) {
          const res = await API.postWithAuth(
            `mobile/profile/experiences/${experience.id}`,
            { ...payload, _method: 'PUT' },
            token,
          );
          saved = res?.data?.data ?? res?.data ?? { ...experience, ...payload };
        }
      } else {
        // Backend route naming differs across environments. Try a few common options.
        const createEndpoints = [
          'mobile/profile/experiences',
          'mobile/profile/experience',
          'mobile/experiences',
          'mobile/experience',
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
            if (err?.response?.status !== 404) break; // don't hide non-404 errors (validation, auth, etc.)
          }
        }
        if (lastError) throw lastError;
      }

      onSaved?.(saved);
      onClose();
    } catch (err) {
      console.error('[EXPERIENCE_FORM] save error:', err);
      const status = err?.response?.status;
      if (status === 404) {
        Alert.alert(
          'API route not found (404)',
          'The app could not find the Experience endpoint on the server. Please check your backend routes for the mobile experience create endpoint.'
        );
      } else {
        Alert.alert('Error', 'Could not save experience. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = () => {
    Alert.alert(
      'Delete Experience',
      'Are you sure you want to remove this experience?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const deleteEndpoints = [
                `mobile/profile/experiences/${experience.id}`,
                `mobile/profile/experience/${experience.id}`,
                `mobile/experiences/${experience.id}`,
                `mobile/experience/${experience.id}`,
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

              onDeleted?.(experience.id);
              onClose();
            } catch (err) {
              console.error('[EXPERIENCE_FORM] delete error:', err);
              const status = err?.response?.status;
              if (status === 404) {
                Alert.alert(
                  'API route not found (404)',
                  'The app could not find the Experience delete endpoint on the server. Please check your backend routes for the mobile experience delete endpoint.'
                );
              } else {
                Alert.alert('Error', 'Could not delete experience. Please try again.');
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
        {/* ── Header ── */}
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
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: 'rgba(255,200,1,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="briefcase" size={14} color="#ffc801" />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#fff' : '#1a1a1a' }}>
              {isEditMode ? 'Edit Experience' : 'Add Experience'}
            </Text>
          </View>

          {/* Delete button — edit mode only */}
          {isEditMode ? (
            <TouchableOpacity onPress={handleDelete} hitSlop={12} activeOpacity={0.7} disabled={deleting}>
              {deleting
                ? <ActivityIndicator size="small" color="#ef4444" />
                : <Ionicons name="trash-outline" size={22} color="#ef4444" />
              }
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
          {/* ── Title ── */}
          <InputCard label="Job Title / Role *" icon="briefcase-outline" isDark={isDark}>
            <StyledTextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Frontend Developer"
              isDark={isDark}
            />
          </InputCard>

          {/* ── Company ── */}
          <InputCard label="Company / Organization" icon="business-outline" isDark={isDark}>
            <StyledTextInput
              value={company}
              onChangeText={setCompany}
              placeholder="e.g. Lionsgeek"
              isDark={isDark}
            />
          </InputCard>

          {/* ── Location ── */}
          <InputCard label="Location" icon="location-outline" isDark={isDark}>
            <StyledTextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Casablanca, Morocco"
              isDark={isDark}
            />
          </InputCard>

          {/* ── Employment type ── */}
          <EmploymentTypePicker value={employmentType} onChange={setEmploymentType} isDark={isDark} />

          {/* ── Start date ── */}
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

          {/* ── Currently working here toggle ── */}
          <TouchableOpacity
            onPress={() => setIsCurrent((prev) => !prev)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isCurrent
                ? 'rgba(255,200,1,0.1)'
                : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1.5,
              borderColor: isCurrent
                ? '#ffc801'
                : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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
                  I currently work here
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', marginTop: 1 }}>
                  End date will show as &quot;Present&quot;
                </Text>
              </View>
            </View>
            {/* Visual toggle pill */}
            <View
              style={{
                width: 44, height: 24, borderRadius: 12,
                backgroundColor: isCurrent ? '#ffc801' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 20, height: 20, borderRadius: 10,
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

          {/* ── End date (hidden if current) ── */}
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

          {/* ── Description ── */}
          <InputCard label="Description" icon="document-text-outline" isDark={isDark}>
            <StyledTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your role, key achievements, or responsibilities…"
              multiline
              isDark={isDark}
            />
          </InputCard>

          {/* ── Save button ── */}
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
                  {isEditMode ? 'Save Changes' : 'Add Experience'}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
