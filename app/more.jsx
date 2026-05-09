import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { useAppContext } from '@/context';
import { router } from 'expo-router';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import { resolveAvatarUrl, getUserRolesNormalized } from '@/components/helpers/helpers';
import { Colors } from '@/constants/Colors';

const ACCENT = '#F5C518';
const ACCENT_MUTED = 'rgba(245, 197, 24, 0.85)';
const BG_DEEP = '#0D0C0B';
/** Tappable row inside a premium settings card. */
function SettingRow({
  icon,
  label,
  sublabel,
  onPress,
  right,
  danger = false,
  disabled = false,
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={onPress && !disabled ? 0.65 : 1}
      disabled={disabled}
      className="flex-row items-center px-5 py-4"
    >
      <View className="mr-3.5 h-10 w-10 items-center justify-center rounded-xl bg-alpha/12 dark:bg-alpha/15">
        <Ionicons name={icon} size={20} color={danger ? '#ef4444' : ACCENT} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${danger ? 'text-red-500' : 'text-beta dark:text-white'}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text className="mt-0.5 text-xs font-medium text-black/45 dark:text-white/45" numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {right ?? null}
    </TouchableOpacity>
  );
}

function RowDivider() {
  return <View className="mx-5 h-px bg-black/[0.06] dark:bg-white/10" />;
}

function SectionLabel({ title }) {
  return (
    <Text className="mb-2 mt-8 px-5 text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-[#a89f94]">
      {title}
    </Text>
  );
}

function SettingsCard({ children }) {
  return (
    <View className="mx-5 overflow-hidden rounded-3xl border border-black/[0.06] bg-white dark:border-white/5 dark:bg-[#1A1816]">
      {children}
    </View>
  );
}

function NotificationBadge({ count }) {
  if (!count || count < 1) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <View className="min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-alpha px-1.5">
      <Text className="text-[11px] font-extrabold text-beta">{label}</Text>
    </View>
  );
}

export default function More() {
  const { user, token, signOut, colorScheme, setTheme } = useAppContext();
  const isDark = colorScheme === 'dark';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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

  const refreshUnread = useCallback(async () => {
    if (!token) return;
    try {
      const response = await API.getWithAuth('notifications', token);
      const list = response?.data?.notifications ?? [];
      const unread = list.filter((n) => !n.read_at).length;
      setUnreadNotifications(unread);
    } catch {
      setUnreadNotifications(0);
    }
  }, [token]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  const handleThemeToggle = (value) => {
    setTheme(value ? 'dark' : 'light');
  };

  const handleBiometricComingSoon = () => {
    Alert.alert('Biometric login', 'Biometric unlock will be available in a future update.', [
      { text: 'OK', style: 'default' },
    ]);
  };

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
      { cancelable: true },
    );
  };

  const displayProfile = profile || user;
  const imageUrl = resolveAvatarUrl(displayProfile?.avatar || displayProfile?.image);
  const initials = (displayProfile?.name || displayProfile?.username || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const roles = getUserRolesNormalized(displayProfile);
  const canViewMembers = roles.some((r) => ['admin', 'coach'].includes(String(r).toLowerCase()));

  const chevron = (
    <Ionicons
      name="chevron-forward"
      size={18}
      color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)'}
    />
  );

  const openExternal = (url) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', 'Please try again later.');
    });
  };

  return (
    <AppLayout showNavbar={false} className="dark:bg-[#0D0C0B]">
      <ScrollView
        className="flex-1 bg-light dark:bg-[#0D0C0B]"
        contentContainerClassName="pb-14"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile — centered premium block */}
        <View className="items-center px-6 pb-2 pt-6">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.82}
            className="items-center"
          >
            {loading ? (
              <ProfileSkeleton isDark={isDark} />
            ) : (
              <>
                <View className="relative mb-4">
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      className="h-[88px] w-[88px] rounded-full border-2 border-alpha"
                      defaultSource={require('@/assets/images/icon.png')}
                    />
                  ) : (
                    <View className="h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-alpha bg-alpha/15">
                      <Text className="text-2xl font-bold text-alpha">{initials}</Text>
                    </View>
                  )}
                  <View className="absolute -bottom-0.5 -right-0.5 h-7 w-7 items-center justify-center rounded-full border-[2.5px] border-white bg-alpha dark:border-[#0D0C0B]">
                    <Ionicons name="checkmark" size={16} color={Colors.beta} />
                  </View>
                </View>
                <Text className="text-center text-xl font-bold text-beta dark:text-white">
                  {displayProfile?.name || displayProfile?.username || 'User'}
                </Text>
                <Text className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.35em] text-alpha">
                  View profile
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Account settings */}
        <SectionLabel title="Account settings" />
        <SettingsCard>
          <SettingRow
            icon="person-outline"
            label="Personal information"
            sublabel="Photo, name & profile details"
            onPress={() => router.push('/(tabs)/profile')}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="lock-closed-outline"
            label="Password & security"
            sublabel="Reset password & account safety"
            onPress={() => router.push('/auth/forgot-password')}
            right={chevron}
          />
        </SettingsCard>

        {/* App preferences */}
        <SectionLabel title="App preferences" />
        <SettingsCard>
          <SettingRow
            icon={isDark ? 'moon' : 'sunny-outline'}
            label="Dark mode"
            sublabel={isDark ? 'Premium dark theme enabled' : 'Light theme'}
            right={
              <Switch
                value={isDark}
                onValueChange={handleThemeToggle}
                trackColor={{ false: 'rgba(120,120,120,0.35)', true: ACCENT }}
                thumbColor={Platform.OS === 'android' ? (isDark ? BG_DEEP : '#fafafa') : undefined}
                ios_backgroundColor="rgba(120,120,120,0.35)"
              />
            }
          />
          <RowDivider />
          <SettingRow
            icon="finger-print-outline"
            label="Biometric login"
            sublabel="Face ID / fingerprint"
            right={
              <Switch
                value={false}
                onValueChange={handleBiometricComingSoon}
                trackColor={{ false: 'rgba(120,120,120,0.35)', true: ACCENT }}
                thumbColor={Platform.OS === 'android' ? '#fafafa' : undefined}
                ios_backgroundColor="rgba(120,120,120,0.35)"
              />
            }
          />
        </SettingsCard>

        {/* Community & content */}
        <SectionLabel title="Community & content" />
        <SettingsCard>
          <SettingRow
            icon="qr-code-outline"
            label="Scan QR code"
            sublabel="Check in to a training session"
            onPress={() => router.push('/(tabs)/training/qr-scanner')}
            right={chevron}
          />
          <RowDivider />
          {canViewMembers ? (
            <SettingRow
              icon="people-outline"
              label="Members directory"
              sublabel="Community roster"
              onPress={() => router.push('/(tabs)/members')}
              right={chevron}
            />
          ) : (
            <SettingRow
              icon="people-outline"
              label="Members directory"
              sublabel="Restricted · coach or admin only"
              disabled
              right={<Ionicons name="lock-closed-outline" size={18} color={ACCENT_MUTED} />}
            />
          )}
          <RowDivider />
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            sublabel="Alerts & mentions"
            onPress={() => router.push('/(tabs)/notifications')}
            right={
              <View className="flex-row items-center gap-2">
                <NotificationBadge count={unreadNotifications} />
                {chevron}
              </View>
            }
          />
          <RowDivider />
          <SettingRow
            icon="folder-open-outline"
            label="Project tools"
            sublabel="Training & sessions"
            onPress={() => router.push('/(tabs)/training')}
            right={chevron}
          />
        </SettingsCard>

        {/* Help & legal */}
        <SectionLabel title="Help & legal" />
        <SettingsCard>
          <SettingRow
            icon="help-circle-outline"
            label="Support center"
            sublabel="Help articles & contact"
            onPress={() => openExternal('https://lionsgeek.com')}
            right={<Ionicons name="open-outline" size={18} color={ACCENT_MUTED} />}
          />
          <RowDivider />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Terms & conditions"
            sublabel="Policies & agreements"
            onPress={() => openExternal('https://lionsgeek.com')}
            right={chevron}
          />
        </SettingsCard>

        {/* Log out */}
        <View className="mx-5 mt-10">
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.75}
            className="flex-row items-center justify-center rounded-2xl py-4"
          >
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
            <Text className="ml-2 text-[16px] font-bold text-red-500">Log out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View className="mt-8 items-center px-6 pb-4">
          <Text className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-white/35">
            LionsGeek mobile v{appVersion}-stable
          </Text>
          <Text className="mt-2 text-center text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-white/25">
            Proudly built for the ecosystem
          </Text>
        </View>
      </ScrollView>
    </AppLayout>
  );
}

function ProfileSkeleton({ isDark }) {
  return (
    <View className="items-center py-2">
      <Skeleton width={88} height={88} borderRadius={999} isDark={isDark} />
      <View className="h-4" />
      <Skeleton width={160} height={18} borderRadius={8} isDark={isDark} />
      <View className="h-3" />
      <Skeleton width={120} height={12} borderRadius={8} isDark={isDark} />
    </View>
  );
}
