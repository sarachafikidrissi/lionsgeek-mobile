import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

const { width: SW } = Dimensions.get('window');

// ─── Social platform config ────────────────────────────────────────────────────

// ─── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'Studying',     label: 'Studying',     icon: 'school-outline' },
  { value: 'Working',      label: 'Working',      icon: 'briefcase-outline' },
  { value: 'Internship',   label: 'Internship',   icon: 'business-outline' },
  { value: 'Freelancing',  label: 'Freelancing',  icon: 'laptop-outline' },
  { value: 'Unemployed',   label: 'Unemployed',   icon: 'search-outline' },
];

// ─── Status selector ───────────────────────────────────────────────────────────

function StatusSelector({ value, onChange, isDark }) {
  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: value
          ? '#ffc801'
          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {/* Label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons
          name="radio-button-on-outline"
          size={13}
          color={value ? '#ffc801' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
          style={{ marginRight: 5 }}
        />
        <Text
          style={{
            fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: value ? '#ffc801' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
          }}
        >
          Status
        </Text>
      </View>

      {/* Option grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STATUS_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(active ? '' : opt.value)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: 24,
                backgroundColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1.5,
                borderColor: active
                  ? '#ffc801'
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Ionicons
                name={opt.icon}
                size={14}
                color={active ? '#212529' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? '700' : '500',
                  color: active ? '#212529' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Social platform config ────────────────────────────────────────────────────

const PLATFORMS = [
  { value: 'github',    label: 'GitHub',    icon: 'logo-github',           domains: ['github.com']    },
  { value: 'linkedin',  label: 'LinkedIn',  icon: 'logo-linkedin',         domains: ['linkedin.com']  },
  { value: 'instagram', label: 'Instagram', icon: 'logo-instagram',        domains: ['instagram.com'] },
  { value: 'behance',   label: 'Behance',   icon: 'color-palette-outline', domains: ['behance.net']   },
  { value: 'portfolio', label: 'Portfolio', icon: 'briefcase-outline',     domains: []                },
];

/**
 * Returns null if the URL is valid for the platform, or an error string if not.
 * Portfolio has no domain restriction.
 */
function validatePlatformUrl(platformValue, url) {
  const plat = PLATFORMS.find((p) => p.value === platformValue);
  if (!plat || plat.domains.length === 0) return null; // portfolio — any URL allowed

  const lower = url.toLowerCase();
  const matchesDomain = plat.domains.some((domain) => lower.includes(domain));
  if (!matchesDomain) {
    return `Link must contain "${plat.domains[0]}"`;
  }
  return null;
}

function getPlatform(title) {
  return PLATFORMS.find((p) => p.value === title?.toLowerCase()) ?? PLATFORMS[PLATFORMS.length - 1];
}

// ─── Labeled input card ────────────────────────────────────────────────────────

function LabeledInput({
  label, icon, value, onChangeText,
  placeholder, keyboardType, multiline,
  maxLength, isDark,
}) {
  const [focused, setFocused] = useState(false);
  const charCount = value?.length ?? 0;

  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: focused
          ? '#ffc801'
          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      }}
    >
      {/* Label row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons
          name={icon}
          size={13}
          color={focused ? '#ffc801' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
          style={{ marginRight: 5 }}
        />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.5,
            color: focused ? '#ffc801' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        {maxLength && (
          <Text
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: charCount > maxLength * 0.85
                ? '#ef4444'
                : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
            }}
          >
            {charCount}/{maxLength}
          </Text>
        )}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        maxLength={maxLength}
        numberOfLines={multiline ? 4 : 1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontSize: 15,
          fontWeight: '500',
          color: isDark ? '#fff' : '#000',
          textAlignVertical: multiline ? 'top' : 'center',
          minHeight: multiline ? 72 : undefined,
          padding: 0,
        }}
      />
    </View>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
      <View
        style={{
          width: 28, height: 28, borderRadius: 8,
          backgroundColor: 'rgba(255,200,1,0.15)',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 8,
        }}
      >
        <Ionicons name={icon} size={15} color="#ffc801" />
      </View>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: '#ffc801',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </Text>
    </View>
  );
}

// ─── CV file card ──────────────────────────────────────────────────────────────

function CvCard({ resumeName, onPress, isDark }) {
  const hasFile = !!resumeName;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        borderRadius: 16,
        borderWidth: hasFile ? 1.5 : 1.5,
        borderColor: hasFile ? '#ffc801' : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
        borderStyle: hasFile ? 'solid' : 'dashed',
        backgroundColor: hasFile
          ? 'rgba(255,200,1,0.06)'
          : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: hasFile ? 'rgba(255,200,1,0.15)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          alignItems: 'center', justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons
          name={hasFile ? 'document-text' : 'document-text-outline'}
          size={22}
          color={hasFile ? '#ffc801' : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: hasFile ? (isDark ? '#fff' : '#000') : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          }}
          numberOfLines={1}
        >
          {hasFile ? resumeName : 'Upload your CV / Resume'}
        </Text>
        <Text
          style={{
            fontSize: 11,
            marginTop: 2,
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
          }}
        >
          {hasFile ? 'Tap to replace · PDF, DOC, DOCX' : 'PDF, DOC, DOCX · max 10 MB'}
        </Text>
      </View>
      <Ionicons
        name={hasFile ? 'swap-horizontal-outline' : 'cloud-upload-outline'}
        size={20}
        color={hasFile ? '#ffc801' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}
      />
    </TouchableOpacity>
  );
}

// ─── Social link row ───────────────────────────────────────────────────────────

function SocialLinkRow({ link, onDelete, isDark }) {
  const plat = getPlatform(link.title);
  const iconColor = '#ffc801';
  const iconBg = 'rgba(255,200,1,0.12)';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      {/* Platform icon badge */}
      <View
        style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: iconBg,
          alignItems: 'center', justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Ionicons name={plat.icon} size={18} color={iconColor} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: isDark ? '#fff' : '#212529',
            textTransform: 'capitalize',
          }}
        >
          {plat.label}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {link.url}
        </Text>
      </View>

      {/* Delete */}
      <TouchableOpacity
        onPress={() => onDelete(link.id)}
        hitSlop={12}
        activeOpacity={0.7}
        style={{
          width: 30, height: 30, borderRadius: 10,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="trash-outline" size={15} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Add link form ─────────────────────────────────────────────────────────────

function AddLinkForm({ isDark, existingTitles, onAdd, onCancel }) {
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [adding, setAdding] = useState(false);

  // Only show platforms that haven't been added yet
  const available = PLATFORMS.filter(
    (p) => !existingTitles.includes(p.value)
  );

  const canAdd = selectedPlatform && url.trim().length > 4 && !urlError;

  // Validate on every URL change once a platform is selected
  const handleUrlChange = (text) => {
    setUrl(text);
    if (selectedPlatform && text.trim().length > 4) {
      setUrlError(validatePlatformUrl(selectedPlatform, text.trim()) ?? '');
    } else {
      setUrlError('');
    }
  };

  // Also re-validate when platform changes
  const handleSelectPlatform = (value) => {
    setSelectedPlatform(value);
    if (url.trim().length > 4) {
      setUrlError(validatePlatformUrl(value, url.trim()) ?? '');
    }
  };

  const handleAdd = async () => {
    if (!canAdd || adding) return;
    const error = validatePlatformUrl(selectedPlatform, url.trim());
    if (error) { setUrlError(error); return; }
    setAdding(true);
    await onAdd(selectedPlatform, url.trim());
    setAdding(false);
  };

  if (available.length === 0) {
    return (
      <View
        style={{
          borderRadius: 16, borderWidth: 1.5,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          padding: 16, alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
          All platforms added
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(255,200,1,0.06)' : 'rgba(255,200,1,0.05)',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(255,200,1,0.3)',
        padding: 14,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontSize: 11, fontWeight: '700', color: '#ffc801',
          textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
        }}
      >
        Choose Platform
      </Text>

      {/* Available platforms only */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {available.map((p) => {
          const active = selectedPlatform === p.value;
          return (
            <TouchableOpacity
              key={p.value}
              onPress={() => handleSelectPlatform(p.value)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 11, paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active ? '#ffc801' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1.5,
                borderColor: active ? '#ffc801' : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Ionicons
                name={p.icon} size={14}
                color={active ? '#212529' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}
              />
              <Text
                style={{
                  fontSize: 13, fontWeight: '600', marginLeft: 6,
                  color: active ? '#212529' : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                }}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* URL input */}
      <View style={{ marginBottom: urlError ? 6 : 12 }}>
        <TextInput
          value={url}
          onChangeText={handleUrlChange}
          placeholder={
            selectedPlatform
              ? PLATFORMS.find((p) => p.value === selectedPlatform)?.domains[0]
                ? `https://${PLATFORMS.find((p) => p.value === selectedPlatform).domains[0]}/...`
                : 'https://your-portfolio.com'
              : 'Select a platform first'
          }
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!!selectedPlatform}
          style={{
            backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#fff',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 11,
            fontSize: 14,
            color: isDark ? '#fff' : '#000',
            borderWidth: 1.5,
            borderColor: urlError
              ? '#ef4444'
              : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            opacity: selectedPlatform ? 1 : 0.45,
          }}
        />
        {/* Inline error */}
        {!!urlError && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 6 }}>
            <Ionicons name="alert-circle-outline" size={13} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{urlError}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onCancel}
          style={{
            flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={handleAdd}
          disabled={!canAdd || adding}
          style={{
            flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
            backgroundColor: '#ffc801',
            opacity: !canAdd ? 0.4 : 1,
          }}
        >
          {adding
            ? <ActivityIndicator size="small" color="#212529" />
            : <Text style={{ fontSize: 14, fontWeight: '700', color: '#212529' }}>Add Link</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function EditProfileModal({ visible, profile, token, isDark, onClose, onSaved }) {
  const insets = useSafeAreaInsets();

  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [status, setStatus] = useState('');
  const [speciality, setSpeciality] = useState('');

  const [avatarUri, setAvatarUri]   = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const [resumeName, setResumeName] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);

  const [socialLinks, setSocialLinks]   = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showAddLink, setShowAddLink]   = useState(false);

  const [saving, setSaving] = useState(false);

  // Re-initialise when modal opens
  useEffect(() => {
    if (!visible || !profile) return;
    setName(profile.name ?? '');
    setEmail(profile.email ?? '');
    setPhone(profile.phone ?? '');
    setStatus(profile.status ?? '');
    setSpeciality(profile.speciality ?? '');
    setAvatarUri(null);
    setAvatarFile(null);
    setResumeName(profile.resume ?? null);
    setResumeFile(null);
    setShowAddLink(false);
  }, [visible, profile?.id]);

  useEffect(() => {
    if (!visible || !token) return;
    setLinksLoading(true);
    API.getWithAuth('mobile/profile/social-links', token)
      .then((res) => setSocialLinks(res?.data?.data ?? []))
      .catch((err) => console.error('[EDIT_PROFILE] social links:', err))
      .finally(() => setLinksLoading(false));
  }, [visible, token]);

  // ─── Pickers ──────────────────────────────────────────────────────────────────

  const pickAvatar = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setAvatarUri(asset.uri);
      setAvatarFile({ uri: asset.uri, name: 'avatar.jpg', type: asset.mimeType ?? 'image/jpeg' });
    }
  };

  const pickResume = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setResumeFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' });
      setResumeName(asset.name);
    }
  };

  // ─── Social links ──────────────────────────────────────────────────────────────

  const handleAddLink = async (title, url) => {
    try {
      const res = await API.postWithAuth('mobile/profile/social-links', { title, url }, token);
      setSocialLinks((prev) => [...prev, res?.data?.data]);
      setShowAddLink(false);
    } catch (err) {
      console.error('[EDIT_PROFILE] add link:', err);
      Alert.alert('Error', 'Could not add link. Try again.');
    }
  };

  const handleDeleteLink = async (linkId) => {
    setSocialLinks((prev) => prev.filter((l) => l.id !== linkId));
    try {
      await API.remove(`mobile/profile/social-links/${linkId}`, token);
    } catch (err) {
      console.error('[EDIT_PROFILE] delete link:', err);
    }
  };

  // ─── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const form = new FormData();
      if (name.trim())   form.append('name', name.trim());
      if (email.trim())  form.append('email', email.trim());
      form.append('phone', phone.trim());
      form.append('status', status.trim());
      form.append('speciality', speciality.trim());
      if (avatarFile)    form.append('image', avatarFile);
      if (resumeFile)    form.append('resume', resumeFile);

      const res = await API.postWithAuth('mobile/profile/update', form, token);
      onSaved?.(res?.data?.data);
      onClose();
    } catch (err) {
      console.error('[EDIT_PROFILE] save:', err);
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarUrl = avatarUri ?? resolveAvatarUrl(profile?.avatar || profile?.image);

  const bg = isDark ? '#171717' : '#f4f4f5';
  const cardBg = isDark ? '#1f1f1f' : '#ffffff';

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

        {/* ─── Header bar ─────────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: insets.top + 12,
            paddingBottom: 14,
            backgroundColor: cardBg,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
          }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.6}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }}>
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#000' }}>
            Edit Profile
          </Text>

          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={12} activeOpacity={0.7}>
            {saving
              ? <ActivityIndicator size="small" color="#ffc801" />
              : (
                <View style={{ backgroundColor: '#ffc801', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#212529' }}>Save</Text>
                </View>
              )
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* ─── Avatar hero ──────────────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: cardBg,
              alignItems: 'center',
              paddingTop: 28,
              paddingBottom: 24,
              marginBottom: 20,
            }}
          >
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
              {/* Outer gold ring */}
              <View
                style={{
                  width: 112, height: 112,
                  borderRadius: 56,
                  padding: 3,
                  backgroundColor: '#ffc801',
                }}
              >
                {/* White gap ring */}
                <View
                  style={{
                    flex: 1, borderRadius: 56, padding: 2,
                    backgroundColor: cardBg,
                  }}
                >
                  <View style={{ flex: 1, borderRadius: 56, overflow: 'hidden', backgroundColor: isDark ? '#333' : '#e5e5e5' }}>
                    {currentAvatarUrl
                      ? <Image source={{ uri: currentAvatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="person" size={42} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
                        </View>
                      )
                    }
                  </View>
                </View>
              </View>

              {/* Camera badge */}
              <View
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: '#ffc801',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2.5, borderColor: cardBg,
                }}
              >
                <Ionicons name="camera" size={15} color="#212529" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffc801' }}>
                Change Photo
              </Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)', marginTop: 3 }}>
              JPG, PNG or WEBP · max 4 MB
            </Text>
          </View>

          {/* ─── Personal Information ──────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
            <SectionHeader icon="person-outline" title="Personal Info" />

            <LabeledInput
              label="Full Name"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              isDark={isDark}
            />
            <LabeledInput
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              isDark={isDark}
            />
            <LabeledInput
              label="Phone"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="+212 600 000 000"
              keyboardType="phone-pad"
              isDark={isDark}
            />
            <LabeledInput
              label="Speciality"
              icon="code-slash-outline"
              value={speciality}
              onChangeText={setSpeciality}
              placeholder="e.g. Full stack developer, Mobile developer"
              maxLength={255}
              isDark={isDark}
            />
            <StatusSelector value={status} onChange={setStatus} isDark={isDark} />
          </View>

          {/* ─── CV / Resume ───────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
            <SectionHeader icon="document-text-outline" title="CV / Resume" />
            <CvCard resumeName={resumeName} onPress={pickResume} isDark={isDark} />
          </View>

          {/* ─── Social Links ──────────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
            <SectionHeader icon="share-social-outline" title="Social Links" />

            {linksLoading ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ffc801" />
              </View>
            ) : (
              <>
                {socialLinks.map((link) => (
                  <SocialLinkRow
                    key={link?.id}
                    link={link}
                    onDelete={handleDeleteLink}
                    isDark={isDark}
                  />
                ))}

                {(() => {
                  const usedTitles = socialLinks.map((l) => l.title?.toLowerCase());
                  const allUsed = PLATFORMS.every((p) => usedTitles.includes(p.value));

                  if (showAddLink) {
                    return (
                      <AddLinkForm
                        isDark={isDark}
                        existingTitles={usedTitles}
                        onAdd={handleAddLink}
                        onCancel={() => setShowAddLink(false)}
                      />
                    );
                  }

                  if (allUsed) return null;

                  return (
                    <TouchableOpacity
                      onPress={() => setShowAddLink(true)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 14,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: isDark ? 'rgba(255,200,1,0.35)' : 'rgba(255,200,1,0.5)',
                        backgroundColor: 'rgba(255,200,1,0.04)',
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#ffc801" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffc801' }}>
                        Add Social Link
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
          </View>

          {/* ─── Bottom save button ────────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => ({
                backgroundColor: '#ffc801',
                borderRadius: 18,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
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
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#212529', letterSpacing: 0.3 }}>
                    Save Changes
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
