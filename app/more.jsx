import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useAppContext } from '@/context';
import { router } from 'expo-router';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import Rolegard from '@/components/Rolegard';
import Skeleton from '@/components/ui/Skeleton';
import { resolveAvatarUrl, getUserRolesNormalized } from '@/components/helpers/helpers';

// ─── Reusable primitives ──────────────────────────────────────────────────────

/**
 * A single tappable row inside a settings card.
 */
function SettingRow({ icon, iconBg, label, sublabel, onPress, right, danger = false }) {
  const iconColor = danger ? '#ef4444' : '#ffc801';
  const bgClass = danger ? 'bg-red-500/15' : iconBg ?? 'bg-alpha/15';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      className="flex-row items-center px-4 py-3.5"
    >
      <View className={`w-9 h-9 rounded-xl items-center justify-center mr-3.5 ${bgClass}`}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-[15px] font-medium ${
            danger ? 'text-red-500' : 'text-black dark:text-white'
          }`}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">{sublabel}</Text>
        ) : null}
      </View>
      {right ?? null}
    </TouchableOpacity>
  );
}

/** Subtle inset divider that starts after the icon column. */
function RowDivider() {
  return <View className="h-px bg-black/6 dark:bg-white/6 ml-[60px]" />;
}

/** Section label above a settings card. */
function SectionLabel({ title }) {
  return (
    <Text className="text-[11px] font-bold tracking-widest uppercase text-black/40 dark:text-white/40 px-6 mb-2 mt-7">
      {title}
    </Text>
  );
}

/** Grouped card wrapper for rows. */
function SettingsCard({ children }) {
  return (
    <View className="mx-6 bg-white dark:bg-beta rounded-2xl overflow-hidden border border-black/5 dark:border-white/5">
      {children}
    </View>
  );
}

const CHEVRON_LIGHT = 'rgba(0,0,0,0.22)';
const CHEVRON_DARK = 'rgba(255,255,255,0.25)';

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function More() {
  const { user, token, signOut, colorScheme, setTheme } = useAppContext();
  const isDark = colorScheme === 'dark';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch fresh profile data ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setProfile(user);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await API.getWithAuth('mobile/profile', token);
        setProfile(response?.data ?? user);
      } catch (error) {
        console.error('[MORE] Profile fetch error:', error);
        setProfile(user);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, user]);

  // ── Theme toggle ──────────────────────────────────────────────────────────
  const handleThemeToggle = (value) => {
    setTheme(value ? 'dark' : 'light');
  };

  // ── Logout with confirmation ──────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ── Derived display values ────────────────────────────────────────────────
  const displayProfile = profile || user;
  const imageUrl = resolveAvatarUrl(displayProfile?.avatar || displayProfile?.image);
  const initials = (displayProfile?.name || displayProfile?.username || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const roles = getUserRolesNormalized(displayProfile);

  const chevron = (
    <Ionicons name="chevron-forward" size={16} color={isDark ? CHEVRON_DARK : CHEVRON_LIGHT} />
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppLayout showNavbar={false}>
      <ScrollView
        className="flex-1 bg-light dark:bg-dark"
        contentContainerStyle={{ paddingBottom: 52 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ─────────────────────────────────────────────────── */}
        <View className="pt-14 px-6 pb-3">
          <Text className="text-3xl font-bold tracking-tight text-black dark:text-white">
            Settings
          </Text>
        </View>

        {/* ── Profile hero card ──────────────────────────────────────────── */}
        <View className="px-6 mt-2">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.72}
            className="bg-white dark:bg-beta rounded-2xl overflow-hidden border border-black/5 dark:border-white/5"
          >
            {/* Brand accent strip */}
            <View className="h-1.5 bg-alpha" />

            <View className="p-4">
              {loading ? (
                <ProfileSkeleton isDark={isDark} />
              ) : (
                <ProfileContent
                  displayProfile={displayProfile}
                  imageUrl={imageUrl}
                  initials={initials}
                  roles={roles}
                  isDark={isDark}
                />
              )}
            </View>

            {/* View full profile CTA */}
            {!loading && (
              <View className="px-4 pb-4">
                <View className="flex-row items-center justify-center bg-alpha/10 rounded-xl py-2.5">
                  <Text className="text-[13px] font-semibold text-alpha mr-1.5">
                    View Full Profile
                  </Text>
                  <Ionicons name="arrow-forward" size={13} color="#ffc801" />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Quick actions (all users) ───────────────────────────────────── */}
        <SectionLabel title="Actions" />
        <SettingsCard>
          <SettingRow
            icon="qr-code-outline"
            label="Scan QR Code"
            sublabel="Check in to a training session"
            onPress={() => router.push('/(tabs)/training/qr-scanner')}
            right={chevron}
          />
          <Rolegard authorized={['admin', 'coach']}>
            <RowDivider />
            <SettingRow
              icon="people-outline"
              label="View All Members"
              sublabel="Manage the community roster"
              onPress={() => router.push('/(tabs)/members')}
              right={chevron}
            />
          </Rolegard>
        </SettingsCard>

        {/* ── Preferences ────────────────────────────────────────────────── */}
        <SectionLabel title="Preferences" />
        <SettingsCard>
          <SettingRow
            icon={isDark ? 'moon' : 'sunny-outline'}
            label="Dark Mode"
            sublabel={isDark ? 'Currently dark' : 'Currently light'}
            right={
              <Switch
                value={isDark}
                onValueChange={handleThemeToggle}
                trackColor={{ false: 'rgba(0,0,0,0.14)', true: '#ffc801' }}
                thumbColor={Platform.OS === 'android' ? (isDark ? '#171717' : '#fafafa') : undefined}
                ios_backgroundColor="rgba(0,0,0,0.14)"
              />
            }
          />
        </SettingsCard>

        {/* ── Account ────────────────────────────────────────────────────── */}
        <SectionLabel title="Account" />
        <SettingsCard>
          <SettingRow
            icon="person-circle-outline"
            label="Edit Profile"
            sublabel="Update your photo, name & bio"
            onPress={() => router.push('/(tabs)/profile')}
            right={chevron}
          />
        </SettingsCard>

        {/* ── Danger zone ────────────────────────────────────────────────── */}
        <View className="mx-6 mt-7">
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.72}
            className="flex-row items-center justify-center py-4 rounded-2xl bg-red-500/10 border border-red-500/20"
          >
            <Ionicons name="log-out-outline" size={19} color="#ef4444" />
            <Text className="ml-2 text-[15px] font-semibold text-red-500">Log out</Text>
          </TouchableOpacity>
        </View>

        {/* ── App version hint ───────────────────────────────────────────── */}
        <Text className="text-center text-[11px] text-black/25 dark:text-white/25 mt-6">
          LionsGeek v1.0.0
        </Text>
      </ScrollView>
    </AppLayout>
  );
}

// ─── Profile sub-components (extracted to keep More() readable) ──────────────

function ProfileSkeleton({ isDark }) {
  return (
    <View className="flex-row items-center py-1">
      <Skeleton width={60} height={60} borderRadius={16} isDark={isDark} />
      <View className="ml-4 flex-1">
        <Skeleton width={150} height={13} borderRadius={7} isDark={isDark} />
        <View className="h-2" />
        <Skeleton width={190} height={11} borderRadius={7} isDark={isDark} />
        <View className="h-2.5" />
        <Skeleton width={72} height={20} borderRadius={99} isDark={isDark} />
      </View>
    </View>
  );
}

function ProfileContent({ displayProfile, imageUrl, initials, roles, isDark }) {
  return (
    <View className="flex-row items-center">
      {/* Avatar */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          className="w-[60px] h-[60px] rounded-2xl border-2 border-alpha/30"
          defaultSource={require('@/assets/images/icon.png')}
        />
      ) : (
        <View className="w-[60px] h-[60px] rounded-2xl bg-alpha/20 dark:bg-alpha/30 items-center justify-center border-2 border-alpha/35">
          <Text className="text-xl font-bold text-alpha">{initials}</Text>
        </View>
      )}

      {/* User info */}
      <View className="ml-4 flex-1">
        <Text className="text-[15px] font-bold text-black dark:text-white" numberOfLines={1}>
          {displayProfile?.name || displayProfile?.username || 'User'}
        </Text>
        {displayProfile?.email ? (
          <Text
            className="text-[13px] text-black/50 dark:text-white/45 mt-0.5"
            numberOfLines={1}
          >
            {displayProfile.email}
          </Text>
        ) : null}
        {roles.length > 0 ? (
          <View className="flex-row flex-wrap mt-2 gap-1">
            {roles.map((role, idx) => (
              <View key={idx} className="px-2 py-0.5 rounded-full bg-alpha/20">
                <Text className="text-[11px] font-semibold text-alpha capitalize">{role}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'}
      />
    </View>
  );
}
