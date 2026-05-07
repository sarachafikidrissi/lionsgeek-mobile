import { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, ScrollView, View, Text, Image, Pressable, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useAppContext } from '@/context';
import API from '@/api';
import CommentsModal from '@/components/feed/CommentsModal';
import LikesModal from '@/components/feed/LikesModal';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

const CAPTION_PREVIEW_LENGTH = 60;
const SHARE_PAYLOAD_MAX_LEN = 4500;

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const TRAILING_PUNCTUATION_PATTERN = /[).,!?;:]+$/;
const MENTION_PATTERN = /(^|[\s(])@([A-Za-z0-9_]+)/g;

function splitTextByUrls(text) {
  if (!text || typeof text !== 'string') return [];

  const matches = [...text.matchAll(URL_PATTERN)];
  if (matches.length === 0) return [{ type: 'text', value: text }];

  const parts = [];
  let cursor = 0;

  for (const match of matches) {
    const rawUrl = match[0];
    const index = match.index ?? 0;

    if (index > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, index) });
    }

    const cleanUrl = rawUrl.replace(TRAILING_PUNCTUATION_PATTERN, '');
    const trailing = rawUrl.slice(cleanUrl.length);

    parts.push({ type: 'url', value: cleanUrl });
    if (trailing) parts.push({ type: 'text', value: trailing });

    cursor = index + rawUrl.length;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) });
  }

  return parts;
}

function splitTextByMentions(text) {
  if (!text || typeof text !== 'string') return [];

  const matches = [...text.matchAll(MENTION_PATTERN)];
  if (matches.length === 0) return [{ type: 'text', value: text }];

  const parts = [];
  let cursor = 0;

  for (const match of matches) {
    const full = match[0];
    const prefix = match[1] ?? '';
    const handle = match[2] ?? '';
    const index = match.index ?? 0;

    if (index > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, index) });
    }

    if (prefix) parts.push({ type: 'text', value: prefix });
    parts.push({ type: 'mention', value: handle });

    cursor = index + full.length;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) });
  }

  return parts;
}

function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('www.')) return `https://${url}`;
  return null;
}

function clampText(value, maxLen) {
  const str = value == null ? '' : String(value);
  if (maxLen <= 0) return '';
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function buildShareBodyString(post, caption = '') {
  const interactionPost = post?.repost_of ?? null;
  const source = interactionPost ?? post;
  const interactionPostId = post?.interaction_post_id ?? post?.repost_of_post_id ?? post?.id;

  const payload = {
    type: 'post_share',
    post_id: interactionPostId,
    caption: clampText(caption || '', 300),
    author_name: clampText(source?.user_name ?? source?.user?.name ?? '', 80) || null,
    author_image: source?.user_image ?? source?.user?.image ?? null,
    description: clampText(source?.description ?? source?.content ?? '', 400),
    image: Array.isArray(source?.images) && source.images.length > 0 ? source.images[0] : (source?.postImage ?? null),
  };

  let body = JSON.stringify(payload);
  if (body.length > SHARE_PAYLOAD_MAX_LEN) {
    payload.description = clampText(payload.description, 120);
    body = JSON.stringify(payload);
  }
  if (body.length > SHARE_PAYLOAD_MAX_LEN) {
    payload.description = '';
    body = JSON.stringify(payload);
  }
  if (body.length > SHARE_PAYLOAD_MAX_LEN) {
    payload.image = null;
    body = JSON.stringify(payload);
  }
  if (body.length > SHARE_PAYLOAD_MAX_LEN) {
    payload.author_image = null;
    body = JSON.stringify(payload);
  }

  return body;
}

function LinkifiedText({ text, textStyle, linkStyle, mentionStyle, onMentionPress }) {
  const parts = useMemo(() => {
    const urlParts = splitTextByUrls(text);
    return urlParts.flatMap((p) => {
      if (p.type !== 'text') return [p];
      return splitTextByMentions(p.value);
    });
  }, [text]);

  const handleOpenUrl = async (url) => {
    const normalized = normalizeUrl(url);
    if (!normalized) return;

    try {
      const canOpen = await Linking.canOpenURL(normalized);
      if (!canOpen) {
        Alert.alert('Invalid link', 'This link cannot be opened on your device.');
        return;
      }
      await Linking.openURL(normalized);
    } catch (_error) {
      Alert.alert('Link error', 'Failed to open this link. Please try again.');
    }
  };

  return (
    <Text style={textStyle}>
      {parts.map((part, index) => {
        if (part.type === 'mention') {
          return (
            <Text
              key={`m-${index}`}
              onPress={() => onMentionPress?.(part.value)}
              style={mentionStyle}
              accessibilityRole="link"
            >
              @{part.value}
            </Text>
          );
        }

        if (part.type !== 'url') return <Text key={`t-${index}`}>{part.value}</Text>;

        return (
          <Text
            key={`u-${index}`}
            onPress={() => handleOpenUrl(part.value)}
            style={linkStyle}
            accessibilityRole="link"
          >
            {part.value}
          </Text>
        );
      })}
    </Text>
  );
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (weeks > 4) return date.toLocaleDateString();
  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'just now';
}

/**
 * Renders a fully-tappable caption block.
 * - Short captions (≤ CAPTION_PREVIEW_LENGTH chars) → plain text, no toggle.
 * - Long captions → shows preview + "... see more" / full text + " see less".
 */
function Caption({ name, text, textSize = 14, lineHeight = 22, textColor, mutedColor, onMentionPress }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > CAPTION_PREVIEW_LENGTH;

  const displayedText = isLong && !expanded
    ? text.slice(0, CAPTION_PREVIEW_LENGTH).trimEnd()
    : text;

  return (
    <Text style={{ fontSize: textSize, lineHeight, color: textColor }}>
      <Text style={{ fontWeight: '800', color: textColor }}>{name} </Text>
      <LinkifiedText
        text={displayedText}
        textStyle={{ fontSize: textSize, lineHeight, color: textColor }}
        linkStyle={{ color: '#2563eb', textDecorationLine: 'underline', fontWeight: '700' }}
        mentionStyle={{ color: '#ffc801', fontWeight: '900' }}
        onMentionPress={onMentionPress}
      />
      {isLong && !expanded ? (
        <Text
          onPress={() => setExpanded(true)}
          style={{ color: mutedColor, fontWeight: '800' }}
          accessibilityRole="button"
        >
          {'... '}see more
        </Text>
      ) : null}
      {isLong && expanded ? (
        <Text
          onPress={() => setExpanded(false)}
          style={{ color: mutedColor, fontWeight: '800' }}
          accessibilityRole="button"
        >
          {' '}see less
        </Text>
      ) : null}
    </Text>
  );
}

function PostImage({ uri, width, isDark, onDoubleTap }) {
  const heartScale = useSharedValue(0.25);
  const heartOpacity = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(260)
        .onStart(() => {
          if (onDoubleTap) runOnJS(onDoubleTap)();
          heartOpacity.value = 1;
          heartScale.value = 0.25;
          heartScale.value = withSpring(1, { damping: 10, stiffness: 220 });
          heartOpacity.value = withDelay(450, withTiming(0, { duration: 220 }));
        }),
    [heartOpacity, heartScale, onDoubleTap]
  );

  return (
    <GestureDetector gesture={doubleTapGesture}>
      <View style={{ width, aspectRatio: 1, backgroundColor: isDark ? '#1f1f1f' : '#f0f0f0' }}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Instagram-like heart burst */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            },
            heartStyle,
          ]}
        >
          <LionsgeekLikeIcon size={120} color="#ffc801" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function LionsgeekLikeIcon({ size = 26, color }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 36.932 35.121"
      fill="none"
      accessibilityRole="image"
    >
      <Path
        d="M29.876 0H7.053L0 21.706l18.464 13.415 18.468-13.415zM18.465 27.506L7.243 19.353l4.286-13.192H25.4l4.286 13.192z"
        fill={color}
      />
      <Path d="M13.177 19.326l5.288 3.841 5.288-3.841z" fill={color} />
    </Svg>
  );
}

function RepostIcon({ size = 26, color, strokeWidth = 2 }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityRole="image"
    >
      <Path
        d="m17 2 4 4-4 4"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 11v-1a4 4 0 0 1 4-4h14"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="m7 22-4-4 4-4"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 13v1a4 4 0 0 1-4 4H3"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function FeedItem({ item, onPress }) {
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const getRepostSource = (post) => {
    const candidates = [
      post?.repost_of,
      post?.repostOf,
      post?.original_post,
      post?.originalPost,
      post?.interaction_post,
      post?.interactionPost,
      post?.post,
    ];
    return candidates.find((c) => c && typeof c === 'object') ?? null;
  };

  const sourcePost = useMemo(() => getRepostSource(item) ?? item, [item]);
  const effectivePostId =
    sourcePost?.id ??
    sourcePost?.post_id ??
    sourcePost?.postId ??
    item?.interaction_post_id ??
    item?.interactionPostId ??
    item?.repost_of_post_id ??
    item?.repostOfPostId ??
    item?.id;

  const isRepostEntry = useMemo(() => {
    const hasPointer =
      Boolean(getRepostSource(item)) ||
      (item?.interaction_post_id != null && item?.id != null && Number(item.interaction_post_id) !== Number(item.id)) ||
      (item?.interactionPostId != null && item?.id != null && Number(item.interactionPostId) !== Number(item.id));

    return Boolean(
      hasPointer ||
      item?.reposted ||
      item?.is_repost ||
      item?.isRepost ||
      item?.repost_of_post_id ||
      item?.repostOfPostId ||
      (item?.type === 'repost' || item?.post_type === 'repost' || item?.postType === 'repost')
    );
  }, [item]);

  const [liked, setLiked] = useState(Boolean(sourcePost?.is_liked_by_user ?? item?.is_liked_by_user));
  const [likeCount, setLikeCount] = useState((sourcePost?.likes ?? item?.likes) || 0);
  const [saved, setSaved] = useState(Boolean(sourcePost?.is_saved_by_user ?? item?.is_saved_by_user));
  const [commentCount, setCommentCount] = useState((sourcePost?.comments ?? item?.comments) || 0);
  const [showComments, setShowComments] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const [repostedByMe, setRepostedByMe] = useState(Boolean(item.isReposted || item.is_reposted_by_user));
  const [repostCount, setRepostCount] = useState((sourcePost?.reposts ?? item?.reposts) || 0);
  const [repostLoading, setRepostLoading] = useState(false);

  // Send/Share (Instagram-like) modal state
  const [showSendPost, setShowSendPost] = useState(false);
  const [sendTab, setSendTab] = useState('following'); // 'followers' | 'following'
  const [sendFollowers, setSendFollowers] = useState([]);
  const [sendFollowing, setSendFollowing] = useState([]);
  const [sendQuery, setSendQuery] = useState('');
  const [selectedSendUserId, setSelectedSendUserId] = useState(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSending, setSendSending] = useState(false);

  const avatarUrl = resolveAvatarUrl(
    sourcePost?.user?.avatar ||
    sourcePost?.userAvatar ||
    sourcePost?.user?.image ||
    item.user?.avatar ||
    item.userAvatar ||
    item.user?.image
  );
  const mediaUrls = useMemo(() => {
    const imagesLike = sourcePost?.images ?? item.images;
    if (Array.isArray(imagesLike) && imagesLike.length > 0) return imagesLike.filter(Boolean);
    const single = sourcePost?.postImage ?? sourcePost?.image ?? item.postImage ?? item.image;
    if (single) return [single];
    return [];
  }, [item.images, item.postImage, item.image, sourcePost]);
  const hasMedia = mediaUrls.length > 0;
  const isCarousel = mediaUrls.length > 1;
  const [carouselIndex, setCarouselIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const displayName = sourcePost?.user?.name || item.user?.name || 'Unknown';
  const caption = sourcePost?.description || sourcePost?.content || item.description || item.content || '';
  const isOwner = (user?.id && sourcePost?.user?.id) ? Number(user.id) === Number(sourcePost.user.id) : false;
  const profileUserId =
    sourcePost?.user?.id ??
    sourcePost?.userId ??
    sourcePost?.user_id ??
    sourcePost?.user?.user_id ??
    item.user?.id ??
    item.userId ??
    item.user_id ??
    item.user?.user_id;

  const handleOpenProfile = () => {
    // Uses the same route pattern as search/members screens
    if (profileUserId) {
      router.push(`/(tabs)/profile?userId=${profileUserId}`);
      return;
    }
    router.push('/(tabs)/profile');
  };

  const handleMentionPress = async (handle) => {
    if (!handle || !token) return;
    try {
      const response = await API.getWithAuth(
        `mobile/search?q=${encodeURIComponent(handle)}&type=students`,
        token
      );
      const users = response?.data?.results;
      const list = Array.isArray(users) ? users : [];

      const normalized = String(handle).toLowerCase();
      const match =
        list.find((u) => String(u?.username || '').toLowerCase() === normalized) ||
        list.find((u) => String(u?.name || '').toLowerCase().replace(/\s+/g, '') === normalized) ||
        list[0];

      const userId = match?.id;
      if (!userId) {
        Alert.alert('User not found', `Could not find @${handle}.`);
        return;
      }

      router.push(`/(tabs)/profile?userId=${userId}`);
    } catch (_error) {
      Alert.alert('Error', 'Failed to open this profile. Please try again.');
    }
  };

  const handleLike = async () => {
    // Optimistic update — flip immediately so UI feels instant
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);

    try {
      const response = await API.post(`mobile/posts/like/${effectivePostId}`, {}, token);
      // Sync with server truth
      if (response?.data) {
        setLiked(response.data.liked);
        setLikeCount(response.data.likes_count);
      }
    } catch {
      // Revert optimistic update on failure
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    }
  };

  const handleDoubleTapLike = () => {
    // Instagram behavior: double tap only LIKES (doesn't unlike)
    if (!liked) handleLike();
  };

  const handleToggleSave = async () => {
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    const wasSaved = saved;
    setSaved(!wasSaved);

    try {
      const res = await API.post(`mobile/posts/save/${effectivePostId}`, {}, token);
      const next = res?.data?.saved;
      if (typeof next === 'boolean') {
        setSaved(next);
      }
    } catch (_error) {
      setSaved(wasSaved);
      Alert.alert('Error', 'Failed to save post. Please try again.');
    }
  };

  const handleRepost = async () => {
    if (repostLoading) return;
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    const wasReposted = repostedByMe;

    // Optimistic toggle
    setRepostLoading(true);
    setRepostedByMe(!wasReposted);
    setRepostCount((c) => Math.max(0, wasReposted ? c - 1 : c + 1));

    try {
      const endpoint = wasReposted ? 'mobile/posts/unrepost' : 'mobile/posts/repost';
      const response = await API.post(endpoint, { post_id: effectivePostId }, token);

      // Sync counts from server when available
      const serverCount = response?.data?.reposts_count;
      const serverReposted = response?.data?.reposted;
      if (typeof serverReposted === 'boolean') setRepostedByMe(serverReposted);
      if (typeof serverCount === 'number') setRepostCount(Math.max(0, serverCount));
    } catch (_error) {
      // Revert on failure
      setRepostedByMe(wasReposted);
      setRepostCount((c) => Math.max(0, wasReposted ? c + 1 : c - 1));
      Alert.alert('Error', wasReposted ? 'Failed to remove repost. Please try again.' : 'Failed to repost. Please try again.');
    } finally {
      setRepostLoading(false);
    }
  };

  const iconColor = isDark ? '#e5e5e5' : '#262626';
  const textColor = isDark ? '#f5f5f5' : '#111111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const modalBg = isDark ? '#141414' : '#ffffff';
  const modalBorder = isDark ? '#2e2e2e' : '#e8e5e0';

  useEffect(() => {
    if (!showSendPost) return;
    if (!token) {
      setSendError('You must be logged in to send this post.');
      return;
    }

    let mounted = true;
    const fetchFollowerAndFollowingUsers = async () => {
      const profileId = user?.id;
      if (!profileId) {
        setSendError('Profile not available yet. Please try again.');
        return;
      }

      setSendLoading(true);
      setSendError(null);
      try {
        const [followersRes, followingRes] = await Promise.all([
          API.getWithAuth(`mobile/profile/${profileId}/followers`, token),
          API.getWithAuth(`mobile/profile/${profileId}/following`, token),
        ]);

        const followers = followersRes?.data?.data ?? followersRes?.data?.users ?? [];
        const following = followingRes?.data?.data ?? followingRes?.data?.users ?? [];

        if (!mounted) return;
        setSendFollowers(Array.isArray(followers) ? followers : []);
        setSendFollowing(Array.isArray(following) ? following : []);
      } catch (_error) {
        if (!mounted) return;
        setSendError('Failed to load followers/following. Please try again.');
        setSendFollowers([]);
        setSendFollowing([]);
      } finally {
        if (mounted) setSendLoading(false);
      }
    };

    fetchFollowerAndFollowingUsers();

    return () => {
      mounted = false;
    };
  }, [showSendPost, token, user?.id]);

  const sendUsers = useMemo(() => (sendTab === 'followers' ? sendFollowers : sendFollowing), [sendFollowers, sendFollowing, sendTab]);

  const filteredSendUsers = useMemo(() => {
    const q = sendQuery.trim().toLowerCase();
    if (!q) return sendUsers;
    return sendUsers.filter((u) => {
      const name = (u?.name || '').toLowerCase();
      const email = (u?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [sendUsers, sendQuery]);

  const closeSendPostModal = () => {
    setShowSendPost(false);
    setSendQuery('');
    setSendTab('following');
    setSendFollowers([]);
    setSendFollowing([]);
    setSelectedSendUserId(null);
    setSendSending(false);
    setSendError(null);
    setSendLoading(false);
  };

  const handleSendPost = async () => {
    if (!selectedSendUserId || sendSending) return;
    if (!token) {
      setSendError('You must be logged in to send this post.');
      return;
    }

    setSendSending(true);
    setSendError(null);
    const body = buildShareBodyString(item, '');

    try {
      const conversationRes = await API.getWithAuth(`mobile/chat/conversation/${selectedSendUserId}`, token);
      const conversationId = conversationRes?.data?.conversation?.id;
      if (!conversationId) {
        throw new Error('Conversation not available');
      }

      await API.postWithAuth(`mobile/chat/conversation/${conversationId}/send`, { body }, token);
      closeSendPostModal();
      Alert.alert('Sent', 'Post sent in messages.');
    } catch (_error) {
      setSendError('Failed to send post. Please try again.');
    } finally {
      setSendSending(false);
    }
  };

  const resolveUserImageUrl = (u) => {
    const raw = u?.image || u?.avatar;
    if (!raw) return null;
    if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) return raw;
    const baseUrl = (API?.APP_URL || '').replace(/\/+$/, '');
    if (!baseUrl) return null;
    // Matches mobile chat UI convention
    return `${baseUrl}/storage/img/profile/${raw}`;
  };

  const handleDeletePost = () => {
    setShowPostMenu(false);
    Alert.alert(
      'Delete post?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.remove(`mobile/posts/${item.id}`, token);
              if (typeof item.onPostDeleted === 'function') {
                item.onPostDeleted(item.id);
              }
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete the post. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleEditPost = () => {
    setShowPostMenu(false);
    router.push(`/posts/edit/${item.id}`);
  };

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
        marginBottom: 8,
        // Subtle top/bottom border for the card edge
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
      }}
    >
      {/* ── Repost banner ── */}
      {(isRepostEntry || repostedByMe) ? (
        <View className="flex-row items-center px-4 pt-3 pb-1">
          <Ionicons name="repeat" size={14} color={mutedColor} />
          <Text style={{ color: mutedColor }} className="text-xs ml-1 font-semibold">
            {item.reposted_by || (repostedByMe ? (user?.name || 'You') : 'Someone')} reposted
          </Text>
        </View>
      ) : null}

      {/* ── Header ── */}
      <View className="flex-row items-center px-3 py-3">
        <Pressable onPress={handleOpenProfile} className="flex-row items-center flex-1 active:opacity-80">
          {/* Avatar with gold ring */}
          <View
            style={{
              width: 42, height: 42, borderRadius: 21,
              padding: 2,
              backgroundColor: '#ffc801',
              marginRight: 10,
            }}
          >
            <View
              style={{
                flex: 1, borderRadius: 19,
                backgroundColor: isDark ? '#171717' : '#fafafa',
                padding: 1.5,
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  defaultSource={require('@/assets/images/icon.png')}
                  style={{ width: '100%', height: '100%', borderRadius: 18 }}
                />
              ) : (
                <View
                  style={{ flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                  className="bg-beta/10 dark:bg-beta/40"
                >
                  <Text className="text-sm font-extrabold text-black/70 dark:text-white/70">
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Name + time */}
          <View className="flex-1">
            <Text className="font-bold text-[14px] text-black dark:text-white" numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={{ color: mutedColor }} className="text-[11px]">
              {formatTime(item.created_at)}
            </Text>
          </View>
        </Pressable>

        {isOwner ? (
          <TouchableOpacity
            onPress={() => setShowPostMenu(true)}
            className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={iconColor} />
          </TouchableOpacity>
        ) : (
          <View className="h-8 w-8" />
        )}
      </View>

      {/* ── Caption above image (text-only posts) ── */}
      {!hasMedia && caption ? (
        <View className="px-4 pb-3">
          <Caption
            name={displayName}
            text={caption}
            textSize={14}
            lineHeight={22}
            textColor={textColor}
            mutedColor={mutedColor}
            onMentionPress={handleMentionPress}
          />
        </View>
      ) : null}

      {/* ── Media (edge-to-edge) ── */}
      {hasMedia ? (
        <View style={{ width: '100%', backgroundColor: isDark ? '#1f1f1f' : '#f0f0f0' }}>
          {isCarousel ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const nextIndex = Math.round(x / screenWidth);
                  if (nextIndex !== carouselIndex) setCarouselIndex(nextIndex);
                }}
                scrollEventThrottle={16}
              >
                {mediaUrls.map((uri, idx) => (
                  <PostImage
                    key={`${uri}-${idx}`}
                    uri={uri}
                    width={screenWidth}
                    isDark={isDark}
                    onDoubleTap={handleDoubleTapLike}
                  />
                ))}
              </ScrollView>

              {/* Counter (top-right) */}
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                  {carouselIndex + 1}/{mediaUrls.length}
                </Text>
              </View>
            </View>
          ) : (
            <PostImage
              uri={mediaUrls[0]}
              width="100%"
              isDark={isDark}
              onDoubleTap={handleDoubleTapLike}
            />
          )}
        </View>
      ) : null}

      {/* Carousel dots (between media and actions) */}
      {isCarousel ? (
        <View
          style={{
            paddingTop: 10,
            paddingBottom: 6,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {mediaUrls.map((_, idx) => {
            const active = idx === carouselIndex;
            return (
              <View
                key={idx}
                style={{
                  width: active ? 7 : 6,
                  height: active ? 7 : 6,
                  borderRadius: 50,
                  backgroundColor: active ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'),
                }}
              />
            );
          })}
        </View>
      ) : null}

      {/* ── Action bar ── */}
      <View className="px-2 pb-1 mt-5">
        {/* <View
          style={{
            height: 0.5,
            backgroundColor: isDark ? '#2e2e2e' : '#ddd8d0',
            marginBottom: 8,
          }}
        /> */}
        <View className="flex-row items-center justify-between px-2">
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={handleLike}
              style={{
                // width: 40, height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                // backgroundColor: liked ? 'rgba(255,200,1,0.15)' : 'transparent',
              }}
            >
              <LionsgeekLikeIcon size={24} color={liked ? '#ffc801' : iconColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowComments(true)} className="active:opacity-60">
              <Ionicons name="chatbubble-outline" size={24} color={iconColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRepost}
              disabled={repostLoading}
              className="active:opacity-60"
              style={{ opacity: repostLoading ? 0.6 : 1 }}
            >
              {repostLoading ? (
                <ActivityIndicator size="small" color="#ffc801" />
              ) : (
                <RepostIcon
                  size={26}
                  color={repostedByMe ? '#ffc801' : iconColor}
                  strokeWidth={repostedByMe ? 2.6 : 2}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSendPost(true)}
              className="active:opacity-60"
            >
              <Ionicons
                name="paper-plane-outline"
                size={24}
                color={iconColor}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleToggleSave} className="active:opacity-60">
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={saved ? '#ffc801' : iconColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Like count ── */}
      {likeCount > 0 ? (
        <Pressable onPress={() => setShowLikes(true)} className="px-4 pb-1 active:opacity-60">
          <Text className="font-extrabold text-[11px] text-black dark:text-white">
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </Pressable>
      ) : null}

      {/* ── Caption below image (media posts) ── */}
      {hasMedia && caption ? (
        <View className="px-4 pb-1">
          <Caption
            name={displayName}
            text={caption}
            textSize={13}
            lineHeight={20}
            textColor={textColor}
            mutedColor={mutedColor}
            onMentionPress={handleMentionPress}
          />
        </View>
      ) : null}

      {/* ── Comments + reposts info ── */}
      {(commentCount > 0 || repostCount > 0) ? (
        <Pressable onPress={() => setShowComments(true)} className="px-4 pb-1 active:opacity-60">
          <Text style={{ color: mutedColor }} className="text-[12px]">
            {commentCount > 0 ? `View all ${commentCount} comment${commentCount > 1 ? 's' : ''}` : ''}
            {commentCount > 0 && repostCount > 0 ? '  •  ' : ''}
            {repostCount > 0 ? `${repostCount} repost${repostCount > 1 ? 's' : ''}` : ''}
          </Text>
        </Pressable>
      ) : null}

      <View className="pb-3" />

      {/* ── Comments modal ── */}
      <CommentsModal
        visible={showComments}
        postId={effectivePostId}
        postAuthorName={displayName}
        onClose={() => setShowComments(false)}
        onCommentCountChange={(change) => {
          // change can be a delta number OR { set: number } for server-truth sync
          if (typeof change === 'number') {
            if (Number.isNaN(change)) return;
            setCommentCount((c) => Math.max(0, c + change));
            return;
          }
          if (change && typeof change === 'object' && typeof change.set === 'number') {
            setCommentCount(Math.max(0, change.set));
          }
        }}
      />

      <LikesModal
        visible={showLikes}
        postId={effectivePostId}
        onClose={() => setShowLikes(false)}
      />

      {/* Post menu (owner-only) */}
      <Modal
        transparent
        animationType="fade"
        visible={showPostMenu}
        onRequestClose={() => setShowPostMenu(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowPostMenu(false)} />
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 24,
            backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
            borderRadius: 16,
            borderWidth: 0.5,
            borderColor: isDark ? '#2e2e2e' : '#e8e5e0',
            overflow: 'hidden',
          }}
        >
          <Pressable
            onPress={handleEditPost}
            style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons name="pencil" size={18} color={textColor} />
            <Text style={{ color: textColor, fontWeight: '800' }}>Edit</Text>
          </Pressable>
          <View style={{ height: 0.5, backgroundColor: isDark ? '#2e2e2e' : '#e8e5e0' }} />
          <Pressable
            onPress={handleDeletePost}
            style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons name="trash" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '900' }}>Delete</Text>
          </Pressable>
          <View style={{ height: 8, backgroundColor: 'transparent' }} />
          <Pressable onPress={() => setShowPostMenu(false)} style={{ paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' }}>
            <Text style={{ color: mutedColor, fontWeight: '800' }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Send post modal (Instagram-like) */}
      <Modal
        transparent
        animationType="slide"
        visible={showSendPost}
        onRequestClose={closeSendPostModal}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={closeSendPostModal} />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '82%',
            backgroundColor: modalBg,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderTopWidth: 0.5,
            borderColor: modalBorder,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 0.5, borderColor: modalBorder }}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 44, height: 4, borderRadius: 999, backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={closeSendPostModal} style={{ padding: 6 }}>
                <Text style={{ color: mutedColor, fontWeight: '900' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: textColor, fontWeight: '900', fontSize: 16 }}>Send to</Text>
              <TouchableOpacity
                onPress={handleSendPost}
                disabled={!selectedSendUserId || sendSending}
                style={{ padding: 6, opacity: (!selectedSendUserId || sendSending) ? 0.5 : 1 }}
              >
                <Text style={{ color: '#ffc801', fontWeight: '900' }}>
                  {sendSending ? 'Sending…' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Followers / Following toggle */}
            <View
              style={{
                marginTop: 10,
                flexDirection: 'row',
                borderWidth: 0.5,
                borderColor: modalBorder,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => setSendTab('followers')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: sendTab === 'followers' ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)') : 'transparent',
                }}
              >
                <Text style={{ color: textColor, fontWeight: sendTab === 'followers' ? '900' : '800' }}>Followers</Text>
              </Pressable>
              <View style={{ width: 0.5, backgroundColor: modalBorder }} />
              <Pressable
                onPress={() => setSendTab('following')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: sendTab === 'following' ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)') : 'transparent',
                }}
              >
                <Text style={{ color: textColor, fontWeight: sendTab === 'following' ? '900' : '800' }}>Following</Text>
              </Pressable>
            </View>

            {/* Search */}
            <View
              style={{
                marginTop: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 0.5,
                borderColor: modalBorder,
                backgroundColor: isDark ? '#1d1d1d' : '#f5f5f5',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Ionicons name="search" size={16} color={mutedColor} />
              <TextInput
                value={sendQuery}
                onChangeText={setSendQuery}
                placeholder="Search"
                placeholderTextColor={mutedColor}
                style={{ flex: 1, color: textColor, fontWeight: '700' }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Body */}
          <ScrollView style={{ paddingHorizontal: 10 }} contentContainerStyle={{ paddingVertical: 10, paddingBottom: 18 }}>
            {sendLoading ? (
              <View style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color="#ffc801" />
                <Text style={{ color: mutedColor, marginTop: 10, fontWeight: '700' }}>
                  Loading {sendTab === 'followers' ? 'followers' : 'following'}…
                </Text>
              </View>
            ) : filteredSendUsers.length === 0 ? (
              <View style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: mutedColor, fontWeight: '700' }}>
                  {sendError ? sendError : `No ${sendTab === 'followers' ? 'followers' : 'following'} found.`}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {sendError ? (
                  <View style={{ paddingHorizontal: 6, paddingBottom: 6 }}>
                    <Text style={{ color: '#ef4444', fontWeight: '800' }}>{sendError}</Text>
                  </View>
                ) : null}

                {filteredSendUsers.map((u) => {
                  const selected = Number(selectedSendUserId) === Number(u?.id);
                  const imageUrl = resolveUserImageUrl(u);
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => setSelectedSendUserId((prev) => (Number(prev) === Number(u?.id) ? null : u?.id))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        backgroundColor: selected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent',
                      }}
                    >
                      <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: isDark ? '#232323' : '#eaeaea', marginRight: 10 }}>
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="person" size={20} color={mutedColor} />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: textColor, fontWeight: '900' }} numberOfLines={1}>
                          {u?.name || 'User'}
                        </Text>
                        {u?.email ? (
                          <Text style={{ color: mutedColor, marginTop: 2, fontWeight: '700' }} numberOfLines={1}>
                            {u.email}
                          </Text>
                        ) : null}
                      </View>

                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          borderWidth: 2,
                          borderColor: selected ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'),
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 10,
                        }}
                      >
                        {selected ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: '#ffc801' }} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
