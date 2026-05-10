import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  Image,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Modal,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AppLayout from '@/components/layout/AppLayout';
import CreatePost from '@/components/feed/CreatePost';
import FeedItem from '@/components/feed/FeedItem';
import Rolegard from '@/components/Rolegard';
import Skeleton from '@/components/ui/Skeleton';
import EditProfileModal from '@/components/profile/EditProfileModal';
import ExperienceFormModal from '@/components/profile/ExperienceFormModal';
import EducationFormModal from '@/components/profile/EducationFormModal';
import {
  resolveAvatarUrl,
  resolvePostMediaUrl,
  resolveCoverUrl,
  parseSavedPostsFromApiResponse,
  normalizeSavedPostsList,
} from '@/components/helpers/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getLastExperience(profile) {
  const candidates =
    profile?.experiences ??
    profile?.experience ??
    profile?.user_experiences ??
    profile?.userExperiences ??
    [];

  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (list.length === 0) return null;

  const score = (exp) => {
    const date =
      exp?.end_date ??
      exp?.endDate ??
      exp?.to ??
      exp?.until ??
      exp?.created_at ??
      exp?.createdAt ??
      exp?.updated_at ??
      exp?.updatedAt ??
      null;

    const ts = date ? new Date(date).getTime() : NaN;
    return Number.isFinite(ts) ? ts : -Infinity;
  };

  const sorted = [...list].sort((a, b) => score(b) - score(a));
  const best = sorted[0];
  return best ?? list[list.length - 1] ?? null;
}

function normalizeSocialLinks(profile, fallbackList = []) {
  const fromProfile =
    profile?.social_links ??
    profile?.socialLinks ??
    profile?.social_links_list ??
    profile?.links ??
    null;

  const list = Array.isArray(fromProfile) ? fromProfile : Array.isArray(fallbackList) ? fallbackList : [];
  return list
    .filter(Boolean)
    .map((l) => ({
      id: l?.id ?? `${l?.title ?? ''}:${l?.url ?? ''}`,
      title: String(l?.title ?? l?.platform ?? '').toLowerCase(),
      url: String(l?.url ?? l?.link ?? '').trim(),
    }))
    .filter((l) => l.url.length > 0);
}

function iconForSocialTitle(title) {
  const t = String(title ?? '').toLowerCase();
  if (t.includes('github')) return 'logo-github';
  if (t.includes('linkedin')) return 'logo-linkedin';
  if (t.includes('instagram')) return 'logo-instagram';
  if (t.includes('behance')) return 'color-palette-outline';
  if (t.includes('portfolio') || t.includes('website') || t.includes('site')) return 'globe-outline';
  return 'link-outline';
}

function OnlineBadge({ lastOnline }) {
  if (!lastOnline) return null;

  const diffMinutes = Math.floor((Date.now() - new Date(lastOnline)) / 60000);
  const isOnline = diffMinutes <= 5;

  if (!isOnline) return null;

  return (
    <View
      className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-good border-2 border-light dark:border-dark"
    />
  );
}

function StatColumn({ label, value, onPress }) {
  return (
    <TouchableOpacity className="items-center flex-1" onPress={onPress} activeOpacity={0.7}>
      <Text className="text-lg font-bold text-black dark:text-white">{value ?? 0}</Text>
      <Text className="text-xs text-black/50 dark:text-white/50 mt-0.5">{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Follow List Modal (shared for followers + following) ───────────────────

function FollowUserRow({ user, isDark, currentUserId, token, onPress }) {
  const avatarUrl = resolveAvatarUrl(user.avatar || user.image);
  const isSelf = Number(user.id) === Number(currentUserId);

  // Initialised from the API field; toggled optimistically on press.
  const [isFollowing, setIsFollowing] = useState(!!user.is_following);
  const [followLoading, setFollowLoading] = useState(false);

  const handleFollow = async () => {
    if (followLoading) return;
    const next = !isFollowing;
    setIsFollowing(next); // optimistic
    setFollowLoading(true);
    try {
      await API.postWithAuth(`mobile/users/${user.id}/follow`, {}, token);
    } catch (err) {
      console.error('[FOLLOW] error:', err);
      setIsFollowing(!next); // revert on failure
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3"
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View className="w-12 h-12 rounded-full overflow-hidden bg-alpha/10 items-center justify-center mr-3">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name="person" size={22} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
        )}
      </View>

      {/* Info */}
      <View className="flex-1 mr-3">
        <Text className="text-sm font-semibold text-black dark:text-white" numberOfLines={1}>
          {user.name}
        </Text>
        {user.status ? (
          <Text className="text-xs text-black/50 dark:text-white/50 mt-0.5" numberOfLines={1}>
            {user.status}
          </Text>
        ) : user.promo ? (
          <Text className="text-xs text-black/50 dark:text-white/50 mt-0.5">Promo {user.promo}</Text>
        ) : null}
      </View>

      {/* Follow button — hidden for the current user's own row */}
      {!isSelf && (
        <Pressable
          onPress={handleFollow}
          disabled={followLoading}
          className={`px-4 py-1.5 rounded-lg ${isFollowing
            ? 'border border-black/20 dark:border-white/20 bg-transparent'
            : 'bg-alpha'
            }`}
          style={{ opacity: followLoading ? 0.5 : 1 }}
        >
          <Text
            className={`text-xs font-bold ${isFollowing ? 'text-black dark:text-white' : 'text-beta'
              }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </TouchableOpacity>
  );
}

function FollowListModal({ visible, type, profileId, token, currentUserId, insets, isDark, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch only when the modal opens
  useEffect(() => {
    if (!visible || !profileId || !token) return;

    const endpoint = `mobile/profile/${profileId}/${type}`;
    setLoading(true);
    setError(null);
    setUsers([]);

    API.getWithAuth(endpoint, token)
      .then((res) => setUsers(res?.data?.data || []))
      .catch((err) => {
        console.error(`[PROFILE] ${type} fetch error:`, err);
        setError('Could not load list. Try again.');
      })
      .finally(() => setLoading(false));
  }, [visible, profileId, type, token]);

  const title = type === 'followers' ? 'Followers' : 'Following';

  const handleUserPress = (user) => {
    onClose();
    router.push({ pathname: '/(tabs)/profile', params: { userId: user.id } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View
          className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
          style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text className="ml-3 text-base font-bold text-black dark:text-white">{title}</Text>
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 px-4 pt-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} className="flex-row items-center gap-3">
                <Skeleton width={48} height={48} borderRadius={24} isDark={isDark} />
                <View className="flex-1 gap-2">
                  <Skeleton width="55%" height={13} borderRadius={8} isDark={isDark} />
                  <Skeleton width="38%" height={10} borderRadius={8} isDark={isDark} />
                </View>
              </View>
            ))}
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="cloud-offline-outline" size={48} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
            <Text className="text-black/50 dark:text-white/50 mt-4 text-sm text-center">{error}</Text>
          </View>
        ) : users.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="people-outline" size={52} color={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} />
            <Text className="text-black/40 dark:text-white/40 mt-4 text-sm font-medium">
              No {title.toLowerCase()} yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <FollowUserRow
                user={item}
                isDark={isDark}
                currentUserId={currentUserId}
                token={token}
                onPress={handleUserPress}
              />
            )}
            ItemSeparatorComponent={() => (
              <View className="h-px mx-4 bg-black/5 dark:bg-white/5" />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        )}
      </View>
    </Modal>
  );
}


// ─── LinkedIn section helpers ────────────────────────────────────────────────

function formatPeriod(startDate, endDate, isCurrent) {
  const fmt = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  const start = fmt(startDate);
  const end = isCurrent ? 'Present' : fmt(endDate);
  if (!start && !end) return null;
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

function monthAbbr(month) {
  const m = Number(month);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!Number.isFinite(m) || m < 1 || m > 12) return null;
  return names[m - 1];
}

function formatMonthYear(month, year) {
  const y = year != null ? String(year) : '';
  const m = monthAbbr(month);
  if (!m && !y) return null;
  if (!m) return y;
  if (!y) return m;
  return `${m} ${y}`;
}

function formatPeriodFromParts(startMonth, startYear, endMonth, endYear, isCurrent) {
  const start = formatMonthYear(startMonth, startYear);
  const end = isCurrent ? 'Present' : formatMonthYear(endMonth, endYear);
  if (!start && !end) return null;
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

function calcDuration(startDate, endDate, isCurrent) {
  const start = startDate ? new Date(startDate) : null;
  const end = isCurrent || !endDate ? new Date() : new Date(endDate);
  if (!start) return null;
  const totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (totalMonths < 1) return 'Less than a month';
  const years = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;
  return [
    years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '',
    mos > 0 ? `${mos} mo` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function calcDurationFromParts(startMonth, startYear, endMonth, endYear, isCurrent) {
  const sm = Number(startMonth);
  const sy = Number(startYear);
  if (!Number.isFinite(sm) || !Number.isFinite(sy) || sm < 1 || sm > 12) return null;

  const end = (() => {
    if (isCurrent) return new Date();
    const em = Number(endMonth);
    const ey = Number(endYear);
    if (!Number.isFinite(em) || !Number.isFinite(ey) || em < 1 || em > 12) return null;
    return new Date(ey, em - 1, 1);
  })();

  const start = new Date(sy, sm - 1, 1);
  const effectiveEnd = end ?? new Date();
  const totalMonths =
    (effectiveEnd.getFullYear() - start.getFullYear()) * 12 +
    (effectiveEnd.getMonth() - start.getMonth());
  if (totalMonths < 1) return 'Less than a month';
  const years = Math.floor(totalMonths / 12);
  const mos = totalMonths % 12;
  return [
    years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '',
    mos > 0 ? `${mos} mo` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

async function tryFetchFirstList({ token, endpoints }) {
  const listFrom = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    // common nested response shapes: { data: [...] } or { data: { education: [...] } }
    if (payload.data) {
      const nested = listFrom(payload.data);
      if (Array.isArray(nested) && nested.length >= 0) return nested;
    }
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.posts)) return payload.posts;
    if (Array.isArray(payload.feed)) return payload.feed;
    if (Array.isArray(payload.experiences)) return payload.experiences;
    if (Array.isArray(payload.education)) return payload.education;
    if (Array.isArray(payload.educations)) return payload.educations;
    if (Array.isArray(payload.experience)) return payload.experience;
    return [];
  };

  for (const endpoint of endpoints) {
    try {
      const res = await API.getWithAuth(endpoint, token);
      const list = listFrom(res?.data);
      if (Array.isArray(list)) return list;
    } catch (_err) {
      // Try next candidate endpoint
    }
  }
  return [];
}

// ─── About card ──────────────────────────────────────────────────────────────

function AboutCard({ profile, isDark }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const bio = profile?.bio ?? profile?.about ?? profile?.description ?? null;
  const bioText = typeof bio === 'string' ? bio.trim() : String(bio ?? '').trim();
  if (!bioText) return null;

  const MAX_ABOUT_CHARS = 100;
  const isTruncatable = bioText.length > MAX_ABOUT_CHARS;
  const displayedText =
    isExpanded || !isTruncatable
      ? bioText
      : `${bioText.slice(0, MAX_ABOUT_CHARS).trimEnd()}…`;

  const toggleExpanded = () => {
    if (!isTruncatable) return;
    setIsExpanded((prev) => !prev);
  };

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-light dark:bg-dark border border-black/10 dark:border-white/10 p-4">
      <Text className="text-base font-bold text-black dark:text-white mb-2">About</Text>
      <Pressable onPress={toggleExpanded} disabled={!isTruncatable}>
        <Text className="text-sm text-black/70 dark:text-white/70 leading-[22px]">
          {displayedText}
        </Text>
      </Pressable>

      {isTruncatable && (
        <TouchableOpacity onPress={toggleExpanded} activeOpacity={0.7} hitSlop={10}>
          <Text className="mt-2 text-sm text-alpha font-semibold">
            {isExpanded ? 'See less' : 'See more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Experience card ──────────────────────────────────────────────────────────

function ExperienceCard({ profile, isDark, isOwnProfile, token, onExperienceAdded, onExperienceUpdated, onExperienceDeleted }) {
  const rawList =
    profile?.experiences ??
    profile?.experience ??
    profile?.user_experiences ??
    profile?.userExperiences ??
    [];
  const list = Array.isArray(rawList) ? rawList.filter(Boolean) : [];

  const MAX_DESC_CHARS = 140;
  const [expandedByKey, setExpandedByKey] = useState({});
  const [formModal, setFormModal] = useState({ visible: false, experience: null });

  const toggleExpanded = (key) => {
    setExpandedByKey((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  const openAdd  = () => setFormModal({ visible: true, experience: null });
  const openEdit = (exp) => setFormModal({ visible: true, experience: exp });
  const closeForm = () => setFormModal({ visible: false, experience: null });

  return (
    <>
    <View className="mx-4 mb-3 rounded-2xl bg-light dark:bg-dark border border-black/10 dark:border-white/10 overflow-hidden">
      {/* ── Section header ── */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3 border-b border-black/5 dark:border-white/5">
        <View className="flex-row items-center gap-2">
          <View className="w-7 h-7 rounded-lg bg-alpha/15 items-center justify-center">
            <Ionicons name="briefcase" size={14} color="#ffc801" />
          </View>
          <Text className="text-base font-bold text-black dark:text-white">Experience</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {list.length > 0 && (
            <View className="px-2 py-0.5 rounded-full bg-alpha/10">
              <Text className="text-xs font-semibold text-alpha">{list.length}</Text>
            </View>
          )}
          {isOwnProfile && (
            <TouchableOpacity
              onPress={openAdd}
              hitSlop={10}
              activeOpacity={0.7}
              className="w-7 h-7 rounded-full bg-alpha items-center justify-center"
            >
              <Ionicons name="add" size={16} color="#212529" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {list.length === 0 ? (
        <View className="items-center py-8">
          <Ionicons
            name="briefcase-outline"
            size={36}
            color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
          />
          <Text className="text-xs text-black/30 dark:text-white/30 mt-2">
            No experience added yet
          </Text>
          {isOwnProfile && (
            <TouchableOpacity
              onPress={openAdd}
              activeOpacity={0.7}
              className="mt-3 px-4 py-2 rounded-full bg-alpha/15 flex-row items-center gap-1"
            >
              <Ionicons name="add-circle-outline" size={15} color="#ffc801" />
              <Text className="text-xs font-bold text-alpha">Add Experience</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View className="px-4 pt-4 pb-2">
          {list.map((exp, idx) => {
            const title = exp?.title ?? exp?.position ?? exp?.role ?? 'Role';
            const company = exp?.company ?? exp?.company_name ?? exp?.organization ?? null;
            const hasExplicitEnd = !!(exp?.end_date ?? exp?.to ?? exp?.ended_at ?? exp?.endDate ?? exp?.end_year ?? exp?.endYear);
            const isCurrent = exp?.is_current ?? exp?.current ?? (!hasExplicitEnd);
            const startDate = exp?.start_date ?? exp?.from ?? exp?.started_at ?? null;
            const endDate = exp?.end_date ?? exp?.to ?? exp?.ended_at ?? null;
            const startMonth = exp?.start_month ?? exp?.startMonth ?? null;
            const startYear = exp?.start_year ?? exp?.startYear ?? null;
            const endMonth = exp?.end_month ?? exp?.endMonth ?? null;
            const endYear = exp?.end_year ?? exp?.endYear ?? null;
            const location = exp?.location ?? exp?.city ?? exp?.place ?? null;
            const rawDescription =
              exp?.description ??
              exp?.desc ??
              exp?.summary ??
              exp?.details ??
              exp?.responsibilities ??
              exp?.body ??
              exp?.content ??
              exp?.overview ??
              exp?.notes ??
              exp?.note ??
              exp?.text ??
              null;
            // Strip HTML tags in case the backend returns rich-text HTML
            const description =
              typeof rawDescription === 'string'
                ? rawDescription.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
                : null;
            const period =
              formatPeriod(startDate, endDate, isCurrent) ??
              formatPeriodFromParts(startMonth, startYear, endMonth, endYear, isCurrent);
            const duration =
              calcDuration(startDate, endDate, isCurrent) ??
              calcDurationFromParts(startMonth, startYear, endMonth, endYear, isCurrent);
            const isLast = idx === list.length - 1;
            const itemKey = String(exp?.id ?? `${idx}-${title}-${company ?? ''}`);
            const descText = description ?? '';
            const isDescTruncatable = descText.length > MAX_DESC_CHARS;
            const isDescExpanded = !!expandedByKey?.[itemKey];
            const displayedDesc =
              !descText
                ? null
                : isDescExpanded || !isDescTruncatable
                  ? descText
                  : `${descText.slice(0, MAX_DESC_CHARS).trimEnd()}…`;

            return (
              <View key={itemKey} className="flex-row">
                {/* ── Left rail: dot + line ── */}
                <View className="items-center mr-3" style={{ width: 20 }}>
                  {/* Dot */}
                  <View
                    className="w-4 h-4 rounded-full items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: isCurrent ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
                      borderWidth: isCurrent ? 0 : 2,
                      borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                    }}
                  >
                    {isCurrent && (
                      <View className="w-2 h-2 rounded-full bg-beta" />
                    )}
                  </View>
                  {/* Connector line */}
                  {!isLast && (
                    <View
                      className="flex-1 mt-1"
                      style={{
                        width: 1.5,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        minHeight: 24,
                      }}
                    />
                  )}
                </View>

                {/* ── Right: content ── */}
                <View className={`flex-1 ${!isLast ? 'pb-5' : 'pb-2'}`}>
                  {/* Role title row */}
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="text-sm font-bold text-black dark:text-white flex-1 leading-[20px]">
                      {title}
                    </Text>
                    <View className="flex-row items-center gap-1.5 shrink-0">
                      {/* Duration pill */}
                      {duration ? (
                        <View className="px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
                          <Text className="text-[10px] font-semibold text-black/50 dark:text-white/50">
                            {duration}
                          </Text>
                        </View>
                      ) : null}
                      {/* Edit button — own profile only */}
                      {isOwnProfile && (
                        <TouchableOpacity
                          onPress={() => openEdit(exp)}
                          hitSlop={10}
                          activeOpacity={0.7}
                          className="w-6 h-6 rounded-full bg-black/[0.05] dark:bg-white/[0.08] items-center justify-center"
                        >
                          <Ionicons
                            name="pencil"
                            size={11}
                            color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Company */}
                  {company ? (
                    <Text className="text-sm text-black/65 dark:text-white/65 mt-0.5 font-medium">
                      {company}
                    </Text>
                  ) : null}

                  {/* Date range row */}
                  {period ? (
                    <View className="flex-row items-center gap-1.5 mt-1.5">
                      <Ionicons
                        name="calendar-outline"
                        size={11}
                        color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                      />
                      <Text className="text-xs text-black/40 dark:text-white/40">{period}</Text>
                      {isCurrent && (
                        <View className="ml-1 px-1.5 py-0.5 rounded-full bg-alpha/20">
                          <Text className="text-[10px] font-bold text-alpha">Now</Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Location */}
                  {location ? (
                    <View className="flex-row items-center gap-1 mt-1">
                      <Ionicons
                        name="location-outline"
                        size={11}
                        color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                      />
                      <Text className="text-xs text-black/35 dark:text-white/35">{location}</Text>
                    </View>
                  ) : null}

                  {/* Description + see more/less */}
                  {displayedDesc ? (
                    <View className="mt-2 pl-3 border-l-2 border-alpha/30">
                      <Text className="text-[13px] text-black/55 dark:text-white/55 leading-[20px]">
                        {displayedDesc}
                      </Text>
                      {isDescTruncatable && (
                        <TouchableOpacity
                          onPress={() => toggleExpanded(itemKey)}
                          activeOpacity={0.7}
                          hitSlop={10}
                        >
                          <Text className="mt-1.5 text-xs text-alpha font-bold uppercase tracking-wide">
                            {isDescExpanded ? 'See less ↑' : 'See more ↓'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>

    {/* ── Add / Edit modal ── */}
    <ExperienceFormModal
      visible={formModal.visible}
      experience={formModal.experience}
      token={token}
      isDark={isDark}
      onClose={closeForm}
      onSaved={(saved) => {
        if (formModal.experience) {
          onExperienceUpdated?.(saved);
        } else {
          onExperienceAdded?.(saved);
        }
      }}
      onDeleted={(id) => onExperienceDeleted?.(id)}
    />
    </>
  );
}

// ─── Education card ───────────────────────────────────────────────────────────

function EducationCard({ profile, isDark }) {
  const rawList =
    profile?.education ??
    profile?.educations ??
    profile?.user_education ??
    profile?.userEducation ??
    [];
  const list = Array.isArray(rawList) ? rawList.filter(Boolean) : [];

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-light dark:bg-dark border border-black/10 dark:border-white/10 p-4">
      <Text className="text-base font-bold text-black dark:text-white mb-4">Education</Text>

      {list.length === 0 ? (
        <View className="items-center py-4">
          <Ionicons
            name="school-outline"
            size={36}
            color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
          />
          <Text className="text-xs text-black/30 dark:text-white/30 mt-2">
            No education added yet
          </Text>
        </View>
      ) : (
        list.map((edu, idx) => {
          const institution =
            edu?.institution ?? edu?.school ?? edu?.university ?? edu?.college ?? 'School';
          const degree = edu?.degree ?? edu?.diploma ?? edu?.level ?? null;
          const field =
            edu?.field ?? edu?.field_of_study ?? edu?.specialization ?? edu?.major ?? null;
          const startDate = edu?.start_date ?? edu?.from ?? edu?.started_at ?? null;
          const endDate = edu?.end_date ?? edu?.to ?? edu?.ended_at ?? null;
          const startMonth = edu?.start_month ?? edu?.startMonth ?? null;
          const startYear = edu?.start_year ?? edu?.startYear ?? null;
          const endMonth = edu?.end_month ?? edu?.endMonth ?? null;
          const endYear = edu?.end_year ?? edu?.endYear ?? null;
          const isCurrent = edu?.is_current ?? edu?.current ?? !endDate;
          const description = edu?.description ?? edu?.activities ?? null;
          const period =
            formatPeriod(startDate, endDate, isCurrent) ??
            formatPeriodFromParts(startMonth, startYear, endMonth, endYear, isCurrent);
          const isLast = idx === list.length - 1;

          return (
            <View
              key={edu?.id ?? idx}
              className={`flex-row ${!isLast ? 'pb-5 mb-4 border-b border-black/5 dark:border-white/5' : ''}`}
            >
              {/* School icon badge */}
              <View className="w-12 h-12 rounded-xl bg-alpha/10 items-center justify-center mr-3 mt-0.5 shrink-0">
                <Ionicons name="school-outline" size={20} color="#ffc801" />
              </View>

              <View className="flex-1">
                <Text className="text-sm font-bold text-black dark:text-white leading-snug">
                  {institution}
                </Text>
                {(degree || field) ? (
                  <Text className="text-sm text-black/60 dark:text-white/60 mt-0.5">
                    {[degree, field].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {period ? (
                  <Text className="text-xs text-black/40 dark:text-white/40 mt-0.5">{period}</Text>
                ) : null}
                {description ? (
                  <Text
                    className="text-sm text-black/55 dark:text-white/55 mt-1.5 leading-[20px]"
                    numberOfLines={3}
                  >
                    {description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// ─── Profile Tab Bar ──────────────────────────────────────────────────────────

const PROFILE_TABS = [
  { icon: 'grid-outline',      activeIcon: 'grid',      label: 'Posts'   },
  { icon: 'briefcase-outline', activeIcon: 'briefcase', label: 'Resume'  },
  { icon: 'repeat-outline',    activeIcon: 'repeat',    label: 'Reposts' },
  { icon: 'bookmark-outline',  activeIcon: 'bookmark',  label: 'Saved Posts' },
];

function ProfileTabBar({ activeTab, onTabChange, isDark }) {
  return (
    <View
      className="flex-row bg-light dark:bg-dark"
      style={{ borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
    >
      {PROFILE_TABS.map((tab, index) => {
        const isActive = activeTab === index;
        return (
          <TouchableOpacity
            key={index}
            onPress={() => onTabChange(index)}
            activeOpacity={0.7}
            className="flex-1 items-center py-3"
            style={{
              borderBottomWidth: 2,
              borderBottomColor: isActive ? '#ffc801' : 'transparent',
            }}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={20}
              color={isActive ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)')}
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                marginTop: 3,
                color: isActive ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'),
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Posts Grid Tab (Instagram-style 3-column grid) ───────────────────────────

function PostsGridTab({ posts, postsLoading, isDark, onPostPress, emptyLabel = 'No posts yet', emptyIcon = 'images-outline' }) {
  const TILE_SIZE = Math.floor(SCREEN_WIDTH / 3);
  const GAP = 1.5;

  if (postsLoading) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton
            key={i}
            width={TILE_SIZE - GAP * 0.67}
            height={TILE_SIZE}
            borderRadius={0}
            isDark={isDark}
          />
        ))}
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View className="items-center justify-center py-16 px-6">
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-3"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
        >
          <Ionicons
            name={emptyIcon}
            size={30}
            color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}
          />
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          }}
        >
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        backgroundColor: isDark ? '#111' : '#d8d8d8',
      }}
    >
      {posts.map((post) => (
        <TouchableOpacity
          key={String(post.id)}
          onPress={() => onPostPress(post)}
          activeOpacity={0.85}
          style={{ width: TILE_SIZE - GAP * 0.67, height: TILE_SIZE }}
        >
          {post.postImage ? (
            <Image
              source={{ uri: post.postImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f2',
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}
              />
              {post.body ? (
                <Text
                  style={{
                    fontSize: 9,
                    color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)',
                    textAlign: 'center',
                    marginTop: 4,
                    lineHeight: 13,
                  }}
                  numberOfLines={4}
                >
                  {post.body}
                </Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Reposts Tab ──────────────────────────────────────────────────────────────

function isRepostPost(post) {
  const interactionId = post?.interaction_post_id ?? post?.interactionPostId ?? null;
  const selfId = post?.id ?? null;
  const hasInteractionPointer =
    interactionId != null &&
    selfId != null &&
    Number.isFinite(Number(interactionId)) &&
    Number.isFinite(Number(selfId)) &&
    Number(interactionId) !== Number(selfId);

  return Boolean(
    post?.repost_of ??
    post?.repostOf ??
    post?.repost_of_post_id ??
    post?.repostOfPostId ??
    hasInteractionPointer ??
    (post?.type === 'repost' || post?.post_type === 'repost' || post?.postType === 'repost') ??
    // Some APIs mark repost entries with a "reposted" flag + pointer fields.
    // We only treat it as a repost entry if it ALSO points to another post.
    ((post?.reposted || post?.is_repost || post?.isRepost) && (post?.repost_of || post?.repost_of_post_id || hasInteractionPointer)) ??
    null
  );
}

function RepostsGridTab({ reposts, loading, isDark, onPostPress }) {
  const TILE_SIZE = Math.floor(SCREEN_WIDTH / 3);
  const GAP = 1.5;

  if (loading) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton
            key={i}
            width={TILE_SIZE - GAP * 0.67}
            height={TILE_SIZE}
            borderRadius={0}
            isDark={isDark}
          />
        ))}
      </View>
    );
  }

  if (!reposts || reposts.length === 0) {
    return (
      <View className="items-center justify-center py-16 px-6">
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-3"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
        >
          <Ionicons
            name="repeat-outline"
            size={30}
            color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}
          />
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          }}
        >
          No reposts yet
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GAP,
        backgroundColor: isDark ? '#111' : '#d8d8d8',
      }}
    >
      {reposts.map((post) => (
        <TouchableOpacity
          key={String(post.repost_entry_id ?? post.id)}
          onPress={() => onPostPress(post)}
          activeOpacity={0.85}
          style={{ width: TILE_SIZE - GAP * 0.67, height: TILE_SIZE }}
        >
          {post.postImage ? (
            <Image
              source={{ uri: post.postImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                backgroundColor: isDark ? '#1c1c1e' : '#f2f2f2',
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}
              />
              {post.body ? (
                <Text
                  style={{
                    fontSize: 9,
                    color: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)',
                    textAlign: 'center',
                    marginTop: 4,
                    lineHeight: 13,
                  }}
                  numberOfLines={4}
                >
                  {post.body}
                </Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Profile skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton({ isDark, topInset = 0 }) {
  return (
    <View className="flex-1 bg-light dark:bg-dark">
      {/* Skeleton top bar placeholder */}
      <View style={{ height: topInset + 46 }} className="bg-light dark:bg-dark border-b border-black/5 dark:border-white/5" />
      {/* Cover */}
      <View className="h-44 bg-alpha/10 dark:bg-alpha/5" />

      {/* Profile Row */}
      <View className="flex-row items-start px-4 -mt-12 mb-3">
        <Skeleton width={90} height={90} borderRadius={45} isDark={isDark} />
        <View className="flex-1 flex-row justify-around mt-14 ml-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="items-center gap-1">
              <Skeleton width={36} height={16} borderRadius={8} isDark={isDark} />
              <Skeleton width={52} height={10} borderRadius={8} isDark={isDark} />
            </View>
          ))}
        </View>
      </View>

      {/* Bio */}
      <View className="px-4 gap-2 mb-4">
        <Skeleton width={160} height={16} borderRadius={8} isDark={isDark} />
        <Skeleton width={120} height={12} borderRadius={8} isDark={isDark} />
        <Skeleton width={200} height={12} borderRadius={8} isDark={isDark} />
      </View>

      {/* Buttons */}
      <View className="px-4 flex-row gap-2 mb-5">
        <Skeleton width="75%" height={40} borderRadius={10} isDark={isDark} />
        <Skeleton width={40} height={40} borderRadius={10} isDark={isDark} />
        <Skeleton width={40} height={40} borderRadius={10} isDark={isDark} />
      </View>

      {/* Section card placeholders */}
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} className="mx-4 mb-3 rounded-2xl border border-black/10 dark:border-white/10 p-4 gap-2">
          <Skeleton width={100} height={14} borderRadius={7} isDark={isDark} />
          <Skeleton width="90%" height={12} borderRadius={7} isDark={isDark} />
          <Skeleton width="70%" height={12} borderRadius={7} isDark={isDark} />
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { user: currentUser, token, saveAuth } = useAppContext();
  const { userId, id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coverUploading, setCoverUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [reposts, setReposts] = useState([]);
  const [repostsLoading, setRepostsLoading] = useState(false);
  const [savedPosts, setSavedPosts] = useState([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(-1);
  const [selectedRepostIndex, setSelectedRepostIndex] = useState(-1);
  const [selectedSavedPostIndex, setSelectedSavedPostIndex] = useState(-1);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreateEducation, setShowCreateEducation] = useState(false);
  const [showCreateExperience, setShowCreateExperience] = useState(false);
  const [followModal, setFollowModal] = useState(null); // 'followers' | 'following' | null
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [socialLinks, setSocialLinks] = useState([]);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const feedListRef = useRef(null);
  const repostFeedListRef = useRef(null);

  const insets = useSafeAreaInsets();

  const resolvedUserId = userId ?? id;
  const isOwnProfile = !resolvedUserId || resolvedUserId === currentUser?.id?.toString();

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setPosts([]);
    setSavedPosts([]);
    setSocialLinks([]);
    setActiveTab(0);
    setSelectedPostIndex(-1);
    setSelectedRepostIndex(-1);
    setSelectedSavedPostIndex(-1);
  }, [resolvedUserId]);

  const loadProfile = useCallback(async () => {
    if (!token && !isOwnProfile) return;
    if (isOwnProfile && !token && !currentUser) return;

    try {
      if (isOwnProfile) {
        if (!token) { setProfile(currentUser); return; }
        const res = await API.getWithAuth('mobile/profile', token);
        const next = res?.data || currentUser;
        setProfile(next);
      } else {
        const res = await API.getWithAuth(`mobile/profile/${resolvedUserId}`, token);
        if (res?.data) setProfile(res.data);
      }
    } catch (err) {
      console.error('[PROFILE] fetch error:', err);
      if (isOwnProfile) setProfile(currentUser);
    } finally {
      setLoading(false);
    }
  }, [token, resolvedUserId, isOwnProfile, currentUser]);

  const loadPosts = useCallback(async (profileId, profileName) => {
    if (!token || !profileId) return;

    setPostsLoading(true);
    try {
      // Prefer backend endpoints that return a user's posts directly.
      // Fallback to filtering `mobile/feed` only if needed.
      const directCandidates = [
        `mobile/profile/${profileId}/posts`,
        `mobile/users/${profileId}/posts`,
        `mobile/posts/user/${profileId}`,
        `mobile/posts?user_id=${profileId}`,
        `mobile/posts?userId=${profileId}`,
      ];

      let list = await tryFetchFirstList({ token, endpoints: directCandidates });
      if (!Array.isArray(list) || list.length === 0) {
        const res = await API.getWithAuth('mobile/feed', token);
        list = Array.isArray(res?.data?.feed ?? res?.data?.posts)
          ? (res?.data?.feed ?? res?.data?.posts)
          : [];
      }

      const normalized = list
        .filter((post) => {
          const pid = post?.user?.id ?? post?.author?.id ?? post?.user_id ?? post?.userId;
          return pid != null && Number(pid) === Number(profileId);
        })
        .map((post) => {
          const body =
            post?.body ??
            post?.content ??
            post?.text ??
            post?.caption ??
            post?.description ??
            post?.message ??
            post?.post_body ??
            post?.postBody ??
            null;
          const userAvatar = post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
          const userImage = post.user?.image || post.author?.image || post.user_image || post.author_image;
          const avatarUrl = resolveAvatarUrl(userAvatar || userImage);
          const mediaUrl = resolvePostMediaUrl(post);
          return {
            ...post,
            body,
            user: {
              ...(post.user || post.author || {}),
              id: post.user?.id || post.author?.id || post.user_id || post.userId || profileId,
              name: post.user?.name || post.author?.name || post.user_name || post.author_name || profileName || 'Unknown',
              avatar: avatarUrl,
              image: userImage,
            },
            userAvatar: avatarUrl,
            postImage: mediaUrl,
            image: mediaUrl,
          };
        });

      setPosts(normalized);
    } catch (err) {
      console.error('[PROFILE] fetch posts error:', err);
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [token]);

  const loadReposts = useCallback(async (profileId, profileName) => {
    if (!token || !profileId) return;

    setRepostsLoading(true);
    try {
      const repostCandidates = [
        `mobile/profile/${profileId}/reposts`,
        `mobile/users/${profileId}/reposts`,
        `mobile/posts/reposts?user_id=${profileId}`,
        `mobile/posts/reposts?userId=${profileId}`,
      ];

      let list = await tryFetchFirstList({ token, endpoints: repostCandidates });

      // Fallback: if API doesn't have repost endpoints, extract repost entries from general feed.
      if (!Array.isArray(list) || list.length === 0) {
        const res = await API.getWithAuth('mobile/feed', token);
        const feedList = Array.isArray(res?.data?.feed ?? res?.data?.posts)
          ? (res?.data?.feed ?? res?.data?.posts)
          : [];

        list = feedList.filter((post) => {
          const pid = post?.user?.id ?? post?.author?.id ?? post?.user_id ?? post?.userId;
          return pid != null && Number(pid) === Number(profileId) && isRepostPost(post);
        });
      }

      const getRepostSource = (post) => {
        const candidates = [
          post?.repost_of,
          post?.repostOf,
          post?.original_post,
          post?.originalPost,
          post?.interaction_post,
          post?.interactionPost,
          post?.post, // some APIs wrap the original post here
        ];
        return candidates.find((c) => c && typeof c === 'object') ?? null;
      };

      const normalized = (Array.isArray(list) ? list : [])
        .filter((post) => isRepostPost(post))
        .map((post) => {
          const source = getRepostSource(post) ?? post;

          const originalId =
            source?.id ??
            source?.post_id ??
            source?.postId ??
            post?.interaction_post_id ??
            post?.interactionPostId ??
            post?.repost_of_post_id ??
            post?.repostOfPostId ??
            post?.id ??
            null;

          const resolveImages = (imagesLike) => {
            if (!Array.isArray(imagesLike)) return [];
            return imagesLike
              .map((img) => {
                if (!img) return null;
                if (typeof img === 'string') return resolvePostMediaUrl(img);
                if (typeof img === 'object') {
                  return resolvePostMediaUrl(
                    img?.url ?? img?.uri ?? img?.path ?? img?.image ?? img?.image_url ?? img?.src ?? null
                  );
                }
                return null;
              })
              .filter(Boolean);
          };

          const body =
            source?.body ??
            source?.content ??
            source?.text ??
            source?.caption ??
            source?.description ??
            source?.message ??
            source?.post_body ??
            source?.postBody ??
            null;

          const originalUserAvatar =
            source?.user?.avatar || source?.author?.avatar || source?.user_avatar || source?.author_avatar;
          const originalUserImage =
            source?.user?.image || source?.author?.image || source?.user_image || source?.author_image;
          const originalAvatarUrl = resolveAvatarUrl(originalUserAvatar || originalUserImage);

          const resolvedImages = resolveImages(source?.images);
          const mediaUrl = resolvedImages?.[0] ?? resolvePostMediaUrl(source);
          const repostedBy =
            post?.user?.name ||
            post?.author?.name ||
            post?.user_name ||
            post?.author_name ||
            profileName ||
            'Someone';

          return {
            ...post,
            // Keep repost entry id for stable keys / debugging
            repost_entry_id: post?.id ?? null,
            // Treat the item as the ORIGINAL post for interactions (like/comment/share)
            id: originalId ?? post?.id,
            // Preserve repost timestamp separately (the API "repost entry" time)
            repost_created_at: post?.created_at ?? post?.repost_created_at ?? null,
            // Display ORIGINAL post time in UI (under original author name)
            created_at: source?.created_at ?? post?.created_at ?? null,
            // Make sure the UI shows the ORIGINAL post content (tile + feed)
            body,
            description: source?.description ?? source?.content ?? post?.description ?? post?.content ?? null,
            content: source?.content ?? source?.description ?? post?.content ?? post?.description ?? null,
            // Force media into the same "array of absolute URL strings" shape FeedItem expects,
            // otherwise double-tap gestures & rendering can break.
            images: resolvedImages.length > 0 ? resolvedImages : [],
            postImage: mediaUrl,
            image: mediaUrl,

            // Counts should match ORIGINAL post
            likes:
              source?.likes ??
              source?.likes_count ??
              source?.likesCount ??
              post?.likes ??
              post?.likes_count ??
              post?.likesCount ??
              0,
            comments:
              source?.comments ??
              source?.comments_count ??
              source?.commentsCount ??
              post?.comments ??
              post?.comments_count ??
              post?.commentsCount ??
              0,
            reposts:
              source?.reposts ??
              source?.reposts_count ??
              source?.repostsCount ??
              post?.reposts ??
              post?.reposts_count ??
              post?.repostsCount ??
              0,
            is_liked_by_user:
              source?.is_liked_by_user ??
              source?.isLikedByUser ??
              post?.is_liked_by_user ??
              post?.isLikedByUser ??
              false,

            // Keep the ORIGINAL author on the post header
            user: {
              ...(source.user || source.author || {}),
              id:
                source?.user?.id ||
                source?.author?.id ||
                source?.user_id ||
                source?.userId ||
                post?.user?.id ||
                post?.author?.id ||
                post?.user_id ||
                post?.userId,
              name:
                source?.user?.name ||
                source?.author?.name ||
                source?.user_name ||
                source?.author_name ||
                'Unknown',
              avatar: originalAvatarUrl,
              image: originalUserImage,
            },
            userAvatar: originalAvatarUrl,

            // Repost banner
            reposted: true,
            reposted_by: post?.reposted_by || post?.repostedBy || repostedBy,

            // Preserve original source object for share payloads / future features
            repost_of: source,
          };
        });

      setReposts(normalized);
    } catch (err) {
      console.error('[PROFILE] fetch reposts error:', err);
      setReposts([]);
    } finally {
      setRepostsLoading(false);
    }
  }, [token]);

  const loadSavedPosts = useCallback(async () => {
    if (!token) return;

    setSavedPostsLoading(true);
    try {
      // Canonical endpoint (implemented in backend): GET /api/mobile/posts/saved
      const res = await API.getWithAuth('mobile/posts/saved', token);
      const list = parseSavedPostsFromApiResponse(res);
      setSavedPosts(normalizeSavedPostsList(list));
    } catch (err) {
      console.error('[PROFILE] fetch saved posts error:', err);
      setSavedPosts([]);
    } finally {
      setSavedPostsLoading(false);
    }
  }, [token]);

  const hydrateResumeSections = useCallback(async (profileId) => {
    if (!token || !profileId) return;

    // Experiences
    const experiences = await tryFetchFirstList({
      token,
      endpoints: [
        `mobile/profile/${profileId}/experiences`,
        `mobile/profile/${profileId}/experience`,
        `mobile/users/${profileId}/experiences`,
        `mobile/users/${profileId}/experience`,
      ],
    });

    // Education
    const education = await tryFetchFirstList({
      token,
      endpoints: [
        `mobile/profile/${profileId}/education`,
        `mobile/profile/${profileId}/educations`,
        `mobile/users/${profileId}/education`,
        `mobile/users/${profileId}/educations`,
      ],
    });

    if ((experiences && experiences.length > 0) || (education && education.length > 0)) {
      setProfile((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (experiences && experiences.length > 0) next.experiences = experiences;
        if (education && education.length > 0) next.education = education;
        return next;
      });
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (token || (isOwnProfile && currentUser)) loadProfile();
  }, [loadProfile, token, isOwnProfile, currentUser]);

  const loadSocialLinks = useCallback(async () => {
    // For now the app only has a secured "my social links" endpoint.
    // When viewing other users, we rely on any links embedded in the profile payload.
    if (!token || !isOwnProfile) {
      setSocialLinks(normalizeSocialLinks(profile, []));
      return;
    }

    try {
      const res = await API.getWithAuth('mobile/profile/social-links', token);
      const list = res?.data?.data ?? [];
      setSocialLinks(normalizeSocialLinks(profile, list));
    } catch (err) {
      console.error('[PROFILE] social links fetch error:', err);
      setSocialLinks(normalizeSocialLinks(profile, []));
    }
  }, [token, isOwnProfile, profile]);

  useEffect(() => {
    loadSocialLinks();
  }, [loadSocialLinks, profile]);

  useEffect(() => {
    loadPosts(profile?.id, profile?.name);
  }, [loadPosts, profile?.id, profile?.name]);

  useEffect(() => {
    loadReposts(profile?.id, profile?.name);
  }, [loadReposts, profile?.id, profile?.name]);

  useEffect(() => {
    loadSavedPosts();
  }, [loadSavedPosts]);

  useEffect(() => {
    if (activeTab === 3) {
      loadSavedPosts();
    }
  }, [activeTab, loadSavedPosts]);

  useEffect(() => {
    hydrateResumeSections(profile?.id);
  }, [hydrateResumeSections, profile?.id]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await Promise.all([
      loadProfile(),
      loadPosts(profile?.id, profile?.name),
      loadReposts(profile?.id, profile?.name),
      loadSavedPosts(),
    ]);
    setRefreshing(false);
  }, [loadProfile, loadPosts, loadReposts, loadSavedPosts, token, profile?.id, profile?.name]);

  // Sync reactive follow state whenever the profile data arrives / refreshes
  useEffect(() => {
    if (!profile) return;
    setIsFollowing(!!profile.is_following);
    setFollowersCount(profile.followers_count ?? 0);
  }, [profile]);

  const handleFollowToggle = async () => {
    if (followLoading || !token || !profile?.id) return;

    const willFollow = !isFollowing;
    // Optimistic update
    setIsFollowing(willFollow);
    setFollowersCount((prev) => prev + (willFollow ? 1 : -1));
    setFollowLoading(true);

    try {
      await API.postWithAuth(`mobile/users/${profile.id}/follow`, {}, token);
    } catch (err) {
      console.error('[PROFILE] follow toggle error:', err);
      // Revert on failure
      setIsFollowing(!willFollow);
      setFollowersCount((prev) => prev + (willFollow ? -1 : 1));
    } finally {
      setFollowLoading(false);
    }
  };

  const profileImageUrl = profile
    ? resolveAvatarUrl(profile?.avatar || profile?.image)
    : null;

  const coverImageUrl = profile?.cover ? resolveCoverUrl(profile.cover) : null;
  const lastExperience = getLastExperience(profile);
  const lastExperienceLocation =
    // Experience object candidates (if experiences are included in payload)
    lastExperience?.location ??
    lastExperience?.city ??
    lastExperience?.place ??
    lastExperience?.address ??
    lastExperience?.region ??
    lastExperience?.country ??
    lastExperience?.company_location ??
    lastExperience?.companyLocation ??
    // Common flattened API fields (if backend doesn't embed experiences array)
    profile?.last_experience_location ??
    profile?.lastExperienceLocation ??
    profile?.experience_location ??
    profile?.experienceLocation ??
    profile?.city ??
    profile?.location ??
    profile?.address ??
    null;
  const speciality = profile?.speciality ?? profile?.specialty ?? null;

  const originalPosts = posts.filter((p) => !isRepostPost(p));
  const originalPostsCount = originalPosts.length;
  const repostedPosts = reposts;

  const pickAndUploadCover = useCallback(async () => {
    if (!token || !isOwnProfile || coverUploading) return;

    try {
      setCoverUploading(true);

      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const coverFile = {
        uri: asset.uri,
        name: 'cover.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      };

      const form = new FormData();
      form.append('cover', coverFile);

      const res = await API.postWithAuth('mobile/profile/cover', form, token);
      const nextCover = res?.data?.data?.cover ?? res?.data?.cover ?? null;

      if (nextCover) {
        setProfile((prev) => (prev ? { ...prev, cover: nextCover } : prev));
      }
    } catch (err) {
      console.error('[PROFILE] cover upload error:', err);
      Alert.alert('Error', 'Could not update cover. Please try again.');
    } finally {
      setCoverUploading(false);
    }
  }, [token, isOwnProfile, coverUploading]);

  const pickAndUploadAvatar = useCallback(async () => {
    if (!token || !isOwnProfile || avatarUploading) return;

    try {
      setAvatarUploading(true);

      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const avatarFile = {
        uri: asset.uri,
        name: 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      };

      const form = new FormData();
      form.append('image', avatarFile);

      const res = await API.postWithAuth('mobile/profile/update', form, token);
      const updated = res?.data?.data ?? res?.data ?? null;

      if (updated) {
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
        // Keep global auth user in sync (tab avatar, etc.)
        if (currentUser) {
          await saveAuth(token, { ...currentUser, ...updated });
        }
      }
    } catch (err) {
      console.error('[PROFILE] avatar upload error:', err);
      Alert.alert('Error', 'Could not update profile picture. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  }, [token, isOwnProfile, avatarUploading, currentUser, saveAuth]);

  if (loading) {
    return (
      <AppLayout showNavbar={false}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <ProfileSkeleton isDark={isDark} topInset={insets.top} />
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <Ionicons name="person-circle-outline" size={64} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
          <Text className="text-black/50 dark:text-white/50 mt-4 text-base">Profile not found</Text>
        </View>
      </AppLayout>
    );
  }

  const openCreateMenu = () => setShowCreateMenu(true);
  const closeCreateMenu = () => setShowCreateMenu(false);

  const handleCreateAction = (action) => {
    closeCreateMenu();
    if (action === 'post') setShowCreatePost(true);
    if (action === 'education') setShowCreateEducation(true);
    if (action === 'experience') setShowCreateExperience(true);
  };

  return (
    <AppLayout showNavbar={false}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Sticky Top Bar ─── */}
      <View
        className="flex-row items-center justify-between px-4 bg-light dark:bg-dark border-b border-black/5 dark:border-white/5"
        style={{ paddingTop: insets.top + 10, paddingBottom: 10, zIndex: 10 }}
      >
        {isOwnProfile && !userId ? (
          <View style={{ width: 28 }} />
        ) : (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        )}

        <Text className="text-base font-bold text-black dark:text-white tracking-wide">
          {profile?.name || 'Profile'}
        </Text>

        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/more')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1 bg-light dark:bg-dark"
        showsVerticalScrollIndicator={false}
        bounces
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffc801"
            colors={['#ffc801']}
          />
        }
      >
        {/* ─── Cover Image ─── */}
        <View className="h-44 bg-alpha/10 dark:bg-alpha/5 overflow-hidden">
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            /* Lionsgeek branded gradient fallback */
            <View className="w-full h-full bg-alpha/20 dark:bg-alpha/10 items-center justify-center">
              <Text className="text-alpha/30 text-6xl font-black tracking-widest">LG</Text>
            </View>
          )}

          {/* Pin edit button (own profile only) */}
          {isOwnProfile && (
            <Pressable
              onPress={pickAndUploadCover}
              disabled={coverUploading}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Edit cover photo"
              className="absolute top-3 right-3 w-10 h-10 rounded-full items-center justify-center border border-white/20 bg-black/40"
              style={{ opacity: coverUploading ? 0.6 : 1 }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
          )}
        </View>

        {/* ─── Profile Row: Avatar + Stats ─── */}
        <View className="flex-row items-start pl-4 -mt-11 mb-3">
          {/* Avatar */}
          <View className="relative">
            <Pressable
              onPress={() => {
                // Own profile: show options (view / change). Other profile: just view.
                if (isOwnProfile) setShowAvatarOptions(true);
                else setShowAvatarViewer(true);
              }}
              disabled={avatarUploading}
              className="rounded-full border-4 border-light dark:border-dark overflow-hidden"
              style={{ width: 90, height: 90, opacity: avatarUploading ? 0.75 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={isOwnProfile ? 'Profile picture options' : 'View profile picture'}
            >
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full bg-alpha/20 items-center justify-center">
                  <Ionicons name="person" size={36} color={isDark ? '#fff' : '#000'} />
                </View>
              )}

              {/* Uploading overlay */}
              {avatarUploading && (
                <View className="absolute inset-0 items-center justify-center bg-black/35">
                  <ActivityIndicator size="small" color="#ffc801" />
                </View>
              )}
            </Pressable>

            {/* Own profile: show edit hint badge. Other users: show online dot. */}
            {isOwnProfile ? (
              <View className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-alpha border-2 border-light dark:border-dark items-center justify-center">
                <Ionicons name="camera" size={16} color="#212529" />
              </View>
            ) : (
              <OnlineBadge lastOnline={profile?.last_online} />
            )}
          </View>

          {/* Stats */}
          <View className="flex-1 flex-row justify-around mt-14 ml-5">
            <StatColumn label="Posts" value={originalPostsCount} />
            <StatColumn
              label="Followers"
              value={followersCount}
              onPress={() => setFollowModal('followers')}
            />
            <StatColumn
              label="Following"
              value={profile?.following_count ?? 0}
              onPress={() => setFollowModal('following')}
            />
          </View>
        </View>

        {/* ─── Bio Section ─── */}
        <View className="px-4 mb-4">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-xl font-bold text-black dark:text-white leading-tight flex-1 pr-3"
              numberOfLines={1}
            >
              {profile?.name || 'User'}
            </Text>

            {/* Social links (icons, clickable) — aligned with the name */}
            {socialLinks.length > 0 && (
              <View className="flex-row items-center gap-2">
                {socialLinks.map((link) => (
                  <TouchableOpacity
                    key={String(link.id)}
                    activeOpacity={0.75}
                    onPress={async () => {
                      const url = link.url;
                      try {
                        const canOpen = await Linking.canOpenURL(url);
                        if (canOpen) await Linking.openURL(url);
                      } catch (err) {
                        console.error('[PROFILE] open social link error:', err);
                      }
                    }}
                    className="w-8 h-8 rounded-full items-center justify-center border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04]"
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${link.title || 'social'} link`}
                  >
                    <Ionicons
                      name={iconForSocialTitle(link.title)}
                      size={16}
                      color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Last experience location + speciality (under the name) */}
          {(lastExperienceLocation || speciality) && (
            <View className="flex-col flex-wrap items-center mt-1 gap-x-3 gap-y-1">
              {speciality ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name="briefcase-outline"
                    size={13}
                    color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'}
                  />
                  <Text className="text-base text-black/60 dark:text-white/60">
                    {String(speciality)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Role badges */}
          {/* {isOwnProfile && profile?.roles && profile.roles.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1.5">
              {profile.roles.map((role, idx) => (
                <View key={idx} className="px-2.5 py-0.5 rounded-full bg-alpha">
                  <Text className="text-xs font-semibold text-beta capitalize">{role}</Text>
                </View>
              ))}
            </View>
          )} */}

          {/* Status / promo / email */}
          {profile?.status ? (
            <Text className="text-sm text-black/70 dark:text-white/70 mt-1.5 leading-5">
              {profile.status}
            </Text>
          ) : null}
          {profile?.promo ? (
            <Text className="text-sm text-black/50 dark:text-white/50 mt-0.5">
              Promo {profile.promo}
            </Text>
          ) : null}
          {/* {isOwnProfile && profile?.email ? (
            <Text className="text-sm text-alpha mt-0.5">{profile.email}</Text>
          ) : null} */}
          <View className='flex-row items-center gap-3'>
            {lastExperienceLocation ? (
              <View className="flex-row items-center gap-1 mt-1">
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'}
                />
                <Text className="text-xs text-black/40 dark:text-white/40">
                  {String(lastExperienceLocation)}
                </Text>
              </View>
            ) : null}
            {profile?.created_at ? (
              <View className="flex-row items-center mt-1.5 gap-1">
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                />
                <Text className="text-xs text-black/40 dark:text-white/40">
                  Joined{' '}
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ─── Action Buttons ─── */}
        <View className="px-4 flex-row gap-2 mb-5">
          {isOwnProfile ? (
            <>
              <Pressable
                onPress={() => setShowEditProfile(true)}
                className="flex-1 bg-alpha rounded-xl py-2.5 items-center flex-row justify-center active:opacity-70"
              >
                <Ionicons name="create-outline" size={17} color="#212529" />
                <Text className="ml-1.5 text-sm font-bold text-beta">Edit Profile</Text>
              </Pressable>
              <Pressable
                onPress={openCreateMenu}
                className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
              >
                <Ionicons name="add-outline" size={20} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={handleFollowToggle}
                disabled={followLoading}
                style={{ opacity: followLoading ? 0.6 : 1 }}
                className={`flex-1 rounded-xl py-2.5 items-center flex-row justify-center active:opacity-70 ${isFollowing
                  ? 'border border-black/20 dark:border-white/20 bg-transparent'
                  : 'bg-alpha'
                  }`}
              >
                <Ionicons
                  name={isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                  size={17}
                  color={isFollowing ? (isDark ? '#fff' : '#000') : '#212529'}
                />
                <Text
                  className={`ml-1.5 text-sm font-bold ${isFollowing ? 'text-black dark:text-white' : 'text-beta'
                    }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { }}
                className="flex-1 rounded-xl py-2.5 border border-black/15 dark:border-white/15 items-center flex-row justify-center active:opacity-70"
              >
                <Ionicons name="mail-outline" size={17} color={isDark ? '#fff' : '#000'} />
                <Text className="ml-1.5 text-sm font-semibold text-black dark:text-white">Message</Text>
              </Pressable>
              <Pressable
                onPress={() => { }}
                className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
              >
                <Ionicons name="chevron-down" size={18} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            </>
          )}
        </View>

        {/* ─── Admin Details (Rolegard) ─── */}
        <Rolegard authorized={['admin', 'coach']}>
          <View className="mx-4 mb-5 rounded-xl bg-beta/5 dark:bg-white/5 p-4 border border-black/8 dark:border-white/8">
            <Text className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-3">
              Admin Details
            </Text>
            {profile?.phone && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="call-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text className="text-sm text-black/70 dark:text-white/70 ml-2">{profile.phone}</Text>
              </View>
            )}
            {profile?.cin && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="card-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text className="text-sm text-black/70 dark:text-white/70 ml-2">CIN: {profile.cin}</Text>
              </View>
            )}
            {profile?.formation_id && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="school-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text className="text-sm text-black/70 dark:text-white/70 ml-2">Formation ID: {profile.formation_id}</Text>
              </View>
            )}
            <View className="flex-row gap-4 mt-1">
              {profile?.access_cowork !== undefined && (
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={profile.access_cowork ? 'business' : 'business-outline'}
                    size={15}
                    color={profile.access_cowork ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')}
                  />
                  <Text
                    className={`text-xs ${profile.access_cowork ? 'text-alpha font-semibold' : 'text-black/30 dark:text-white/30'}`}
                  >
                    Cowork
                  </Text>
                </View>
              )}
              {profile?.access_studio !== undefined && (
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={profile.access_studio ? 'videocam' : 'videocam-outline'}
                    size={15}
                    color={profile.access_studio ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')}
                  />
                  <Text
                    className={`text-xs ${profile.access_studio ? 'text-alpha font-semibold' : 'text-black/30 dark:text-white/30'}`}
                  >
                    Studio
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Rolegard>

        {/* ─── Profile Tabs ─── */}
        <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />

        {/* Tab 1 — Posts grid (Instagram-style) */}
        {activeTab === 0 && (
          <PostsGridTab
            posts={originalPosts}
            postsLoading={postsLoading}
            isDark={isDark}
            emptyLabel="No posts yet"
            emptyIcon="images-outline"
            onPostPress={(post) =>
              setSelectedPostIndex(originalPosts.findIndex((p) => p.id === post.id))
            }
          />
        )}

        {/* Tab 2 — Resume: About + Experience + Education */}
        {activeTab === 1 && (
          <View className="pt-3">
            <AboutCard profile={profile} isDark={isDark} />

            <ExperienceCard
              profile={profile}
              isDark={isDark}
              isOwnProfile={isOwnProfile}
              token={token}
              onExperienceAdded={(exp) => {
                setProfile((prev) => {
                  if (!prev) return prev;
                  const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                  return { ...prev, experiences: [exp, ...current] };
                });
              }}
              onExperienceUpdated={(updated) => {
                setProfile((prev) => {
                  if (!prev) return prev;
                  const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                  return {
                    ...prev,
                    experiences: current.map((e) =>
                      String(e.id) === String(updated.id) ? { ...e, ...updated } : e
                    ),
                  };
                });
              }}
              onExperienceDeleted={(id) => {
                setProfile((prev) => {
                  if (!prev) return prev;
                  const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                  return {
                    ...prev,
                    experiences: current.filter((e) => String(e.id) !== String(id)),
                  };
                });
              }}
            />

            <EducationCard profile={profile} isDark={isDark} />
          </View>
        )}

        {/* Tab 3 — Reposts */}
        {activeTab === 2 && (
          <RepostsGridTab
            reposts={repostedPosts}
            loading={repostsLoading}
            isDark={isDark}
            onPostPress={(post) =>
              setSelectedRepostIndex(repostedPosts.findIndex((p) => p.id === post.id))
            }
          />
        )}

        {/* Tab 4 — Saved posts */}
        {activeTab === 3 && (
          <PostsGridTab
            posts={savedPosts}
            postsLoading={savedPostsLoading}
            isDark={isDark}
            emptyLabel="No saved posts yet"
            emptyIcon="bookmark-outline"
            onPostPress={(post) =>
              setSelectedSavedPostIndex(savedPosts.findIndex((p) => p.id === post.id))
            }
          />
        )}

        {/* Bottom spacer */}
        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>

      {/* ─── Create dropdown (Post / Education / Experience) ─── */}
      <Modal
        visible={showCreateMenu}
        transparent
        animationType="fade"
        onRequestClose={closeCreateMenu}
      >
        <Pressable
          onPress={closeCreateMenu}
          className="flex-1 bg-black/35 justify-end"
        >
          <Pressable
            onPress={() => {}}
            className="bg-light dark:bg-dark rounded-t-3xl px-4 pt-4 pb-6 border-t border-black/10 dark:border-white/10"
            style={{ paddingBottom: insets.bottom + 18 }}
          >
            <View className="items-center mb-3">
              <View className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20" />
            </View>

            <Text className="text-base font-bold text-black dark:text-white mb-3">
              Create
            </Text>

            <Pressable
              onPress={() => handleCreateAction('post')}
              className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04]"
            >
              <View className="w-9 h-9 rounded-xl bg-alpha/15 items-center justify-center">
                <Ionicons name="create-outline" size={18} color="#ffc801" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-black dark:text-white">Create Post</Text>
                <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">Share something with your network</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
            </Pressable>

            <Pressable
              onPress={() => handleCreateAction('education')}
              className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
            >
              <View className="w-9 h-9 rounded-xl bg-alpha/15 items-center justify-center">
                <Ionicons name="school-outline" size={18} color="#ffc801" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-black dark:text-white">Create Education</Text>
                <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">Add a school or certification</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
            </Pressable>

            <Pressable
              onPress={() => handleCreateAction('experience')}
              className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
            >
              <View className="w-9 h-9 rounded-xl bg-alpha/15 items-center justify-center">
                <Ionicons name="briefcase-outline" size={18} color="#ffc801" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-black dark:text-white">Create Experience</Text>
                <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">Add a role to your resume</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'} />
            </Pressable>

            <Pressable onPress={closeCreateMenu} className="items-center py-3 mt-2">
              <Text className="text-sm font-semibold text-black/60 dark:text-white/60">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Create Post Modal ─── */}
      {showCreatePost && (
        <Modal
          visible={showCreatePost}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCreatePost(false)}
        >
          <View className="flex-1 bg-light dark:bg-dark pt-4">
            <View className="flex-row items-center justify-between px-4 mb-4">
              <Text className="text-lg font-bold text-black dark:text-white">New Post</Text>
              <TouchableOpacity onPress={() => setShowCreatePost(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
            <CreatePost onPostPress={() => setShowCreatePost(false)} />
          </View>
        </Modal>
      )}

      {/* ─── Edit Profile Modal ─── */}
      <EditProfileModal
        visible={showEditProfile}
        profile={profile}
        token={token}
        isDark={isDark}
        onClose={() => setShowEditProfile(false)}
        onSaved={(updated) => {
          if (updated) setProfile((prev) => ({ ...prev, ...updated }));
        }}
      />

      {/* ─── Create Education Modal ─── */}
      <EducationFormModal
        visible={showCreateEducation}
        education={null}
        token={token}
        isDark={isDark}
        onClose={() => setShowCreateEducation(false)}
        onSaved={(saved) => {
          setProfile((prev) => {
            if (!prev) return prev;
            const current = Array.isArray(prev.education) ? prev.education : (Array.isArray(prev.educations) ? prev.educations : []);
            return { ...prev, education: [saved, ...current] };
          });
        }}
        onDeleted={() => {}}
      />

      {/* ─── Create Experience Modal (quick add from + menu) ─── */}
      <ExperienceFormModal
        visible={showCreateExperience}
        experience={null}
        token={token}
        isDark={isDark}
        onClose={() => setShowCreateExperience(false)}
        onSaved={(saved) => {
          setProfile((prev) => {
            if (!prev) return prev;
            const current = Array.isArray(prev.experiences) ? prev.experiences : [];
            return { ...prev, experiences: [saved, ...current] };
          });
        }}
        onDeleted={() => {}}
      />

      {/* ─── Followers / Following Modal ─── */}
      <FollowListModal
        visible={followModal === 'followers' || followModal === 'following'}
        type={followModal ?? 'followers'}
        profileId={profile?.id}
        token={token}
        currentUserId={currentUser?.id}
        insets={insets}
        isDark={isDark}
        onClose={() => setFollowModal(null)}
      />

      {/* ─── Avatar Options Modal (own profile) ─── */}
      <Modal
        visible={showAvatarOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <Pressable
          onPress={() => setShowAvatarOptions(false)}
          className="flex-1 bg-black/55 justify-end"
        >
          <Pressable
            onPress={() => { }}
            className="bg-light dark:bg-dark rounded-t-3xl px-4 pt-4 pb-6 border-t border-black/10 dark:border-white/10"
            style={{ paddingBottom: insets.bottom + 18 }}
          >
            <View className="items-center mb-3">
              <View className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20" />
            </View>

            <Text className="text-base font-bold text-black dark:text-white mb-3">
              Profile picture
            </Text>

            <Pressable
              onPress={() => {
                setShowAvatarOptions(false);
                setShowAvatarViewer(true);
              }}
              className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04]"
            >
              <Ionicons name="eye-outline" size={18} color={isDark ? '#fff' : '#000'} />
              <Text className="text-sm font-semibold text-black dark:text-white">
                View profile picture
              </Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                setShowAvatarOptions(false);
                await pickAndUploadAvatar();
              }}
              disabled={avatarUploading}
              className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
              style={{ opacity: avatarUploading ? 0.6 : 1 }}
            >
              <Ionicons name="image-outline" size={18} color="#ffc801" />
              <Text className="text-sm font-semibold text-black dark:text-white">
                Change profile picture
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowAvatarOptions(false)}
              className="items-center py-3 mt-2"
            >
              <Text className="text-sm font-semibold text-black/60 dark:text-white/60">
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Avatar Viewer Modal ─── */}
      <Modal
        visible={showAvatarViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarViewer(false)}
      >
        <View className="flex-1 bg-black">
          <View
            className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-4"
            style={{ paddingTop: insets.top + 10, zIndex: 5 }}
          >
            <TouchableOpacity
              onPress={() => setShowAvatarViewer(false)}
              hitSlop={12}
              activeOpacity={0.75}
              className="w-10 h-10 rounded-full items-center justify-center bg-white/10"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <Pressable className="flex-1 items-center justify-center" onPress={() => setShowAvatarViewer(false)}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={{ width: '92%', aspectRatio: 1, borderRadius: 18 }}
                resizeMode="cover"
              />
            ) : (
              <View className="w-72 h-72 rounded-2xl bg-white/10 items-center justify-center">
                <Ionicons name="person" size={64} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </Pressable>
        </View>
      </Modal>

      {/* ─── Posts Feed Modal (all posts, scrolled to tapped index) ─── */}
      <Modal
        visible={selectedPostIndex >= 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPostIndex(-1)}
      >
        <View className="flex-1 bg-light dark:bg-dark">
          {/* Modal header */}
          <View
            className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
            style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
          >
            <TouchableOpacity onPress={() => setSelectedPostIndex(-1)} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="ml-3 text-base font-bold text-black dark:text-white">
              {profile?.name || 'Posts'}
            </Text>
          </View>

          {/* Full feed list — starts at the tapped post, scroll freely */}
          <FlatList
            ref={feedListRef}
            data={originalPosts}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <FeedItem item={item} />}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={selectedPostIndex >= 0 ? selectedPostIndex : 0}
            // Required for initialScrollIndex to work reliably on variable-height items:
            // We provide a generous estimate; onScrollToIndexFailed handles edge cases.
            getItemLayout={(_, index) => ({
              length: 520,
              offset: 520 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              // Fallback: wait for list to finish rendering then retry
              feedListRef.current?.scrollToOffset({
                offset: 520 * info.index,
                animated: false,
              });
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        </View>
      </Modal>

      {/* ─── Reposts Feed Modal (all reposts, scrolled to tapped index) ─── */}
      <Modal
        visible={selectedRepostIndex >= 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRepostIndex(-1)}
      >
        <View className="flex-1 bg-light dark:bg-dark">
          {/* Modal header */}
          <View
            className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
            style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
          >
            <TouchableOpacity onPress={() => setSelectedRepostIndex(-1)} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="ml-3 text-base font-bold text-black dark:text-white">
              {profile?.name || 'Reposts'}
            </Text>
          </View>

          <FlatList
            ref={repostFeedListRef}
            data={repostedPosts}
            keyExtractor={(item) => String(item.repost_entry_id ?? item.id)}
            renderItem={({ item }) => <FeedItem item={item} />}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={selectedRepostIndex >= 0 ? selectedRepostIndex : 0}
            getItemLayout={(_, index) => ({
              length: 520,
              offset: 520 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              repostFeedListRef.current?.scrollToOffset({
                offset: 520 * info.index,
                animated: false,
              });
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        </View>
      </Modal>

      {/* ─── Saved Posts Feed Modal (all saved posts, scrolled to tapped index) ─── */}
      <Modal
        visible={selectedSavedPostIndex >= 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedSavedPostIndex(-1)}
      >
        <View className="flex-1 bg-light dark:bg-dark">
          <View
            className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
            style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
          >
            <TouchableOpacity onPress={() => setSelectedSavedPostIndex(-1)} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="ml-3 text-base font-bold text-black dark:text-white">
              Saved Posts
            </Text>
          </View>

          <FlatList
            data={savedPosts}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <FeedItem item={item} />}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={selectedSavedPostIndex >= 0 ? selectedSavedPostIndex : 0}
            getItemLayout={(_, index) => ({
              length: 520,
              offset: 520 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              // Fallback: wait for list to finish rendering then retry
              // (use immediate offset as a best-effort, matching other modals)
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        </View>
      </Modal>
    </AppLayout>
  );
}
