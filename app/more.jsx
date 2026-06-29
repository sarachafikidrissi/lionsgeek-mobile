import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import { useAppContext } from "@/context";
import { router } from "expo-router";
import API from "@/api";
import { Ionicons } from "@expo/vector-icons";
import AppLayout from "@/components/layout/AppLayout";
import Skeleton from "@/components/ui/Skeleton";
import EditProfileModal from "@/components/profile/EditProfileModal";
import SmoothThemeToggle from "@/components/ui/SmoothThemeToggle";
import GamerProfileStats from "@/components/more/GamerProfileStats";
import {
  resolveAvatarUrl,
  getUserRolesNormalized,
} from "@/components/helpers/helpers";
import { Colors } from "@/constants/Colors";

const ACCENT = "#F5C518";
const ACCENT_MUTED = "rgba(245, 197, 24, 0.85)";
/** Tappable row inside a premium settings card. */
function SoonPill() {
  return (
    <View className="rounded-full border border-alpha/35 bg-alpha/12 px-2 py-0.5 dark:bg-alpha/15">
      <Text className="text-[9px] font-extrabold uppercase tracking-wide text-alpha">
        Soon
      </Text>
    </View>
  );
}

function ProPill() {
  return (
    <View className="rounded-full bg-alpha px-2 py-0.5">
      <Text className="text-[9px] font-extrabold uppercase tracking-wide text-beta">
        Pro
      </Text>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  sublabel,
  onPress,
  right,
  pill,
  danger = false,
  disabled = false,
  nonInteractive = false,
}) {
  const trailing =
    pill || right ? (
      <View className="flex-row items-center gap-2">
        {pill}
        {right}
      </View>
    ) : null;

  const rowClass = "flex-row items-center px-5 py-4";
  const inner = (
    <>
      <View className="mr-3.5 h-10 w-10 items-center justify-center rounded-xl bg-alpha/12 dark:bg-alpha/15">
        <Ionicons name={icon} size={20} color={danger ? "#ef4444" : ACCENT} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${danger ? "text-red-500" : "text-beta dark:text-white"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            className="mt-0.5 text-xs font-medium text-black/45 dark:text-white/45"
            numberOfLines={2}
          >
            {sublabel}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );

  if (nonInteractive || !onPress) {
    return <View className={rowClass}>{inner}</View>;
  }

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.65}
      disabled={disabled}
      className={rowClass}
    >
      {inner}
    </TouchableOpacity>
  );
}

function RowDivider() {
  return <View className="mx-5 h-px bg-black/[0.06] dark:bg-white/10" />;
}

function SectionLabel({ title, className = "" }) {
  return (
    <Text
      className={`mb-2 mt-8 px-5 text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500 dark:text-[#a89f94] ${className}`}
    >
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
  const label = count > 99 ? "99+" : String(count);
  return (
    <View className="min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-alpha px-1.5">
      <Text className="text-[11px] font-extrabold text-beta">{label}</Text>
    </View>
  );
}

export default function More() {
  const { user, token, signOut, saveAuth, colorScheme, setTheme } =
    useAppContext();
  const isDark = colorScheme === "dark";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [themeToggleDark, setThemeToggleDark] = useState(isDark);

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  useEffect(() => {
    if (!token) {
      setProfile(user);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await API.getWithAuth("mobile/profile", token);
        setProfile(response?.data ?? user);
      } catch (error) {
        console.error("[MORE] Profile fetch error:", error);
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
      const response = await API.getWithAuth("notifications", token);
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

  useEffect(() => {
    setThemeToggleDark(isDark);
  }, [isDark]);

  const handleThemeToggle = useCallback(
    (value) => {
      setThemeToggleDark(value);
      setTheme(value ? "dark" : "light");
    },
    [setTheme],
  );

  const handleBiometricComingSoon = () => {
    Alert.alert(
      "Biometric login",
      "Biometric unlock will be available in a future update.",
      [{ text: "OK", style: "default" }],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/auth/login");
          },
        },
      ],
      { cancelable: true },
    );
  };

  const displayProfile = profile || user;
  const imageUrl = resolveAvatarUrl(
    displayProfile?.avatar || displayProfile?.image,
  );
  const initials = (displayProfile?.name || displayProfile?.username || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const rolesFromProfile = getUserRolesNormalized(displayProfile);
  const rolesFromUser = getUserRolesNormalized(user);
  const roles = [
    ...new Set([...rolesFromProfile, ...rolesFromUser].map((r) => String(r))),
  ];
  const roleLower = roles.map((r) => String(r).toLowerCase());
  const canViewMembers = roleLower.some((r) => ["admin", "coach"].includes(r));
  const isAdmin = roleLower.includes("admin");
  const canViewReports = roleLower.some((r) => ["admin", "coach"].includes(r));

  const comingSoon = (feature) => () =>
    Alert.alert(
      "Coming soon",
      `${feature} will land in a future update. You’re on the early access path.`,
      [{ text: "Got it", style: "default" }],
    );

  const chevron = (
    <Ionicons
      name="chevron-forward"
      size={18}
      color={isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.22)"}
    />
  );

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
            onPress={() => router.push("/(tabs)/profile")}
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
                      defaultSource={require("@/assets/images/icon.png")}
                    />
                  ) : (
                    <View className="h-[88px] w-[88px] items-center justify-center rounded-full border-2 border-alpha bg-alpha/15">
                      <Text className="text-2xl font-bold text-alpha">
                        {initials}
                      </Text>
                    </View>
                  )}
                  <View className="absolute -bottom-0.5 -right-0.5 h-7 w-7 items-center justify-center rounded-full border-[2.5px] border-white bg-alpha dark:border-[#0D0C0B]">
                    <Ionicons name="checkmark" size={16} color={Colors.beta} />
                  </View>
                </View>
                <Text className="text-center text-xl font-bold text-beta dark:text-white">
                  {displayProfile?.name || displayProfile?.username || "User"}
                </Text>
                <Text className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.35em] text-alpha">
                  View profile
                </Text>
                <Text className="mt-3 max-w-[260px] text-center text-[10px] leading-4 text-neutral-500 dark:text-white/40">
                  Tip: long-press the Profile tab anytime to open this More hub.
                </Text>
                {!loading ? (
                  <GamerProfileStats profile={displayProfile} isDark={isDark} />
                ) : null}
              </>
            )}
          </TouchableOpacity>
        </View>

        <SectionLabel title="Experience mode" className="mt-5" />
        <SettingsCard>
          <SettingRow
            nonInteractive
            icon={themeToggleDark ? "moon" : "sunny-outline"}
            label={themeToggleDark ? "Coding Mode" : "Media Mode"}
            sublabel={
              themeToggleDark
                ? "Dark theme · optimized for focus & code"
                : "Light theme · optimized for media & feed"
            }
            right={
              <SmoothThemeToggle
                value={themeToggleDark}
                onValueChange={handleThemeToggle}
                accent={ACCENT}
              />
            }
          />
        </SettingsCard>

        {/* Account — settings first after profile */}
        <SectionLabel title="Account & security" />
        <SettingsCard>
          <SettingRow
            icon="person-outline"
            label="Personal information"
            sublabel="Photo, name & profile details"
            onPress={() => {
              if (!token) {
                router.push("/auth/login");
                return;
              }
              setShowEditProfile(true);
            }}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="key-outline"
            label="Reset password"
            sublabel="Current password required · then choose a new one"
            onPress={() => router.push("/reset-password")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="mail-unread-outline"
            label="Email & recovery"
            sublabel="Forgot password · we will email you a link"
            onPress={() => router.push("/auth/forgot-password")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="notifications-outline"
            label="Notification preferences"
            sublabel="Inbox categories & system settings"
            onPress={() => router.push("/notification-preferences")}
            right={
              <View className="flex-row items-center gap-2">
                <NotificationBadge count={unreadNotifications} />
                {chevron}
              </View>
            }
          />
        </SettingsCard>

        {/* Feed & library */}
        <SectionLabel title="Feed & library" className="mt-5" />
        <SettingsCard>
          <SettingRow
            icon="bookmark-outline"
            label="Saved posts"
            sublabel="Bookmarks hub — sync when feed API is ready"
            onPress={() => router.push("/saved-posts")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="time-outline"
            label="Recent activity"
            sublabel="Likes, comments, saves, bookings & follows — full trail (no chat)"
            onPress={() => router.push("/activity")}
            right={chevron}
          />
        </SettingsCard>

        {/* Growth & recognition */}
        <SectionLabel title="Growth & recognition" />
        <SettingsCard>
          <SettingRow
            icon="ribbon-outline"
            label="Achievements & badges"
            sublabel="Streaks, tiers & milestones"
            onPress={() => router.push("/achievements")}
            right={chevron}
            pill={<ProPill />}
          />
          <RowDivider />
          <SettingRow
            icon="school-outline"
            label="Learning journey"
            sublabel="Your process: modules, milestones & rhythm"
            onPress={() => router.push("/learning-progress")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="map-outline"
            label="Study roadmap"
            sublabel="Visual path through your cohort curriculum"
            onPress={() => router.push("/learning-progress")}
            right={chevron}
            pill={<ProPill />}
          />
          <RowDivider />
          <SettingRow
            icon="medal-outline"
            label="Certificates vault"
            sublabel="Credentials & milestones (share-ready)"
            onPress={() => router.push("/achievements")}
            right={chevron}
            pill={<SoonPill />}
          />
        </SettingsCard>

        {/* Projects & sessions */}
        <SectionLabel title="Projects & sessions" />
        <SettingsCard>
          <SettingRow
            icon="cube-outline"
            label="Projects hub"
            sublabel="Capstones, briefs & deliveries"
            onPress={() => router.push("/projects-hub")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="clipboard-outline"
            label="Attendance history"
            sublabel="M · L · E by day for your training"
            onPress={() => router.push("/attendance-history")}
            right={chevron}
          />
          <RowDivider />
                    {/* qr scanner */}
        <SettingRow
          icon="qr-code-outline"
          label="Scan QR code"
          sublabel="Quick check-in to a session"
          onPress={() => router.push("/(tabs)/training/qr-scanner")}
          right={chevron}
        />
        </SettingsCard>
        {/* Spaces */}
        <SectionLabel title="Spaces & calendar" />
        <SettingsCard>
          <SettingRow
            icon="calendar-outline"
            label="Studios history"
            sublabel="Only studio reservations you booked"
            onPress={() => router.push("/reservation-history-studio")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="desktop-outline"
            label="Coworking history"
            sublabel="Desks & cowork slots you’ve booked"
            onPress={() => router.push("/reservation-history-cowork")}
            right={chevron}
          />
        </SettingsCard>

        {/* Personalization */}
        <SectionLabel title="Personalization" />
        <SettingsCard>
          <SettingRow
            icon="options-outline"
            label="Customize experience"
            sublabel="Density, alerts roadmap & themes"
            onPress={() => router.push("/customization")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="phone-portrait-outline"
            label="Appearance & layout"
            sublabel="Cards, spacing & hero style"
            onPress={() => router.push("/customization")}
            right={chevron}
            pill={<ProPill />}
          />
          <RowDivider />
          <SettingRow
            icon="volume-high-outline"
            label="Sound & haptics"
            sublabel="Feedback taps, chimes & focus mode"
            onPress={comingSoon("Sound & haptics")}
            right={chevron}
            pill={<SoonPill />}
          />
          <RowDivider />
          <SettingRow
            icon="accessibility-outline"
            label="Accessibility"
            sublabel="Text size, contrast & motion"
            onPress={comingSoon("Accessibility preferences")}
            right={chevron}
            pill={<SoonPill />}
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
                trackColor={{ false: "rgba(120,120,120,0.35)", true: ACCENT }}
                thumbColor={Platform.OS === "android" ? "#fafafa" : undefined}
                ios_backgroundColor="rgba(120,120,120,0.35)"
              />
            }
          />
          <RowDivider />
          <SettingRow
            icon="globe-outline"
            label="Language & region"
            sublabel="English · expand locales soon"
            onPress={comingSoon("Language packs")}
            right={chevron}
            pill={<SoonPill />}
          />
        </SettingsCard>

        {/* Community */}
        <SectionLabel title="Community" />
        <SettingsCard>
          {canViewMembers ? (
            <SettingRow
              icon="people-outline"
              label="Members directory"
              sublabel="Community roster"
              onPress={() => router.push("/(tabs)/members")}
              right={chevron}
            />
          ) : (
            <SettingRow
              icon="people-outline"
              label="Members directory"
              sublabel="Restricted · coach or admin only"
              disabled
              right={
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={ACCENT_MUTED}
                />
              }
            />
          )}
          <RowDivider />
          <SettingRow
            icon="share-social-outline"
            label="Invite teammates"
            sublabel="Share LionsGeek with your cohort"
            onPress={comingSoon("Referrals")}
            right={chevron}
            pill={<SoonPill />}
          />
        </SettingsCard>

        {/* Power user */}
        <SectionLabel title="Power tools" />
        <SettingsCard>
          <SettingRow
            icon="rocket-outline"
            label="Weekly goals"
            sublabel="Set focus targets — ties to Training"
            onPress={() => router.push("/learning-progress")}
            right={chevron}
            pill={<ProPill />}
          />
          <RowDivider />
          <SettingRow
            icon="link-outline"
            label="Linked sessions"
            sublabel="See where you’re signed in"
            onPress={comingSoon("Device & session management")}
            right={chevron}
            pill={<SoonPill />}
          />
          <RowDivider />
          <SettingRow
            icon="cloud-download-outline"
            label="Offline library"
            sublabel="Download lessons for travel mode"
            onPress={comingSoon("Offline library")}
            right={chevron}
            pill={<SoonPill />}
          />
          <RowDivider />
          <SettingRow
            icon="sync-outline"
            label="Calendar sync"
            sublabel="Push sessions to your device calendar"
            onPress={comingSoon("Calendar sync")}
            right={chevron}
            pill={<SoonPill />}
          />
          <RowDivider />
          <SettingRow
            icon="document-text-outline"
            label="Export my data"
            sublabel="GDPR-friendly data portability"
            onPress={comingSoon("Data export")}
            right={chevron}
            pill={<SoonPill />}
          />
          <RowDivider />
          <SettingRow
            icon="trash-outline"
            label="Clear local cache"
            sublabel="Refresh images & temporary files"
            onPress={comingSoon("Clear cache")}
            right={chevron}
            pill={<SoonPill />}
          />
        </SettingsCard>

        {/* Admin & coach insights */}
        {canViewReports ? (
          <>
            <SectionLabel
              title={isAdmin ? "Administration" : "Coach insights"}
            />
            <SettingsCard>
              <SettingRow
                icon="analytics-outline"
                label="Reports & insights"
                sublabel={
                  isAdmin
                    ? "Attendance, engagement & escalations"
                    : "Team pulse, attendance & highlights"
                }
                onPress={() => router.push("/admin-reports")}
                right={chevron}
                pill={<ProPill />}
              />
              <RowDivider />
              <SettingRow
                icon="reader-outline"
                label="Cohort pulse"
                sublabel="Live health of promotions"
                onPress={comingSoon("Cohort pulse")}
                right={chevron}
                pill={<SoonPill />}
              />
              {isAdmin ? (
                <>
                  <RowDivider />
                  <SettingRow
                    icon="warning-outline"
                    label="Moderation queue"
                    sublabel="Flags & reported content"
                    onPress={comingSoon("Moderation queue")}
                    right={chevron}
                    pill={<SoonPill />}
                  />
                </>
              ) : null}
            </SettingsCard>
          </>
        ) : null}

        {/* Coach-only extra visibility */}
        {!isAdmin && canViewMembers ? (
          <>
            <SectionLabel title="Coach shortcuts" />
            <SettingsCard>
              <SettingRow
                icon="people-outline"
                label="Roster insights"
                sublabel="Jump into members"
                onPress={() => router.push("/(tabs)/members")}
                right={chevron}
              />
            </SettingsCard>
          </>
        ) : null}

        {/* Help & legal */}
        <SectionLabel title="Help & legal" />
        <SettingsCard>
          <SettingRow
            icon="sparkles-outline"
            label="What’s new"
            sublabel={`Spotlights · v${appVersion}`}
            onPress={comingSoon(`What’s new in v${appVersion}`)}
            right={chevron}
            pill={<SoonPill />}
          />
          <RowDivider />
          <SettingRow
            icon="chatbox-ellipses-outline"
            label="Send feedback"
            sublabel="Shape the next LionsGeek drop"
            onPress={() => router.push("/support")}
            right={chevron}
            pill={<ProPill />}
          />
          <RowDivider />
          <SettingRow
            icon="help-circle-outline"
            label="Support center"
            sublabel="FAQ & contact"
            onPress={() => router.push("/support")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="document-text-outline"
            label="Terms & conditions"
            sublabel="Rules for using the app"
            onPress={() => router.push("/terms")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="shield-outline"
            label="Privacy policy"
            sublabel="How we handle your data"
            onPress={() => router.push("/privacy")}
            right={chevron}
          />
          <RowDivider />
          <SettingRow
            icon="code-slash-outline"
            label="Open-source licenses"
            sublabel="Third-party software notices"
            onPress={() => router.push("/licenses")}
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
            <Text className="ml-2 text-[16px] font-bold text-red-500">
              Log out
            </Text>
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

      <EditProfileModal
        visible={showEditProfile}
        profile={displayProfile}
        token={token}
        isDark={isDark}
        onClose={() => setShowEditProfile(false)}
        onSaved={(updated) => {
          if (!updated) return;
          setProfile((prev) => ({ ...(prev || user || {}), ...updated }));
          if (token && user) {
            saveAuth(token, { ...user, ...updated }).catch((e) =>
              console.error(
                "[MORE] Failed to sync user after profile edit:",
                e,
              ),
            );
          }
        }}
      />
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
