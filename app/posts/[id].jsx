import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import FeedItem from '@/components/feed/FeedItem';
import Skeleton from '@/components/ui/Skeleton';

export default function PostDetailsScreen() {
  const { id, reportId, commentId } = useLocalSearchParams();
  const postId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);
  const reportIdNumber = useMemo(() => {
    const raw = Array.isArray(reportId) ? reportId[0] : reportId;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [reportId]);
  const focusCommentId = useMemo(() => {
    const raw = Array.isArray(commentId) ? commentId[0] : commentId;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [commentId]);

  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [moderating, setModerating] = useState(false);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      setPost(null);
      return;
    }
    if (!token) {
      setLoading(false);
      setPost(null);
      return;
    }

    let mounted = true;
    const fetchPost = async () => {
      setLoading(true);
      try {
        const res = await API.getWithAuth(`mobile/posts/${postId}`, token);
        const data = res?.data?.post ?? res?.data ?? null;
        if (!mounted) return;
        setPost(data);
      } catch (_error) {
        if (!mounted) return;
        setPost(null);
        Alert.alert('Error', 'Failed to load this post. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPost();
    return () => {
      mounted = false;
    };
  }, [postId, token]);

  const bg = isDark ? '#0f0f0f' : '#ffffff';
  const text = isDark ? '#ffffff' : '#111111';
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';

  const roles = Array.isArray(user?.role) ? user.role : [user?.role].filter(Boolean);
  const isStaff = roles.some((r) => ['admin', 'super_admin', 'moderateur', 'coach', 'studio_responsable'].includes(String(r)));

  const resolveReport = async (action) => {
    if (!token || !reportIdNumber) return;
    if (!isStaff) return;
    if (moderating) return;

    setModerating(true);
    try {
      const endpoint = action === 'accept'
        ? `mobile/post-reports/${reportIdNumber}/accept`
        : `mobile/post-reports/${reportIdNumber}/refuse`;
      await API.postWithAuth(endpoint, {}, token);
      Alert.alert('Done', action === 'accept' ? 'Report accepted.' : 'Report refused.');
      router.back();
    } catch (error) {
      const data = error?.response?.data;
      const msg =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' ? data : null) ||
        error?.message ||
        'Failed to update this report.';
      Alert.alert('Error', String(msg));
    } finally {
      setModerating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: text, fontWeight: '900', fontSize: 16 }}>Post</Text>
          {isStaff && reportIdNumber ? (
            <Text style={{ color: muted, fontWeight: '700', fontSize: 12, marginTop: 2 }}>
              Report moderation
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
        {isStaff && reportIdNumber ? (
          <View style={{ paddingHorizontal: 14, paddingBottom: 12, flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => resolveReport('accept')}
              disabled={moderating}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: '#10b981',
                opacity: moderating ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>Accept report</Text>
            </Pressable>
            <Pressable
              onPress={() => resolveReport('refuse')}
              disabled={moderating}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: '#ef4444',
                opacity: moderating ? 0.7 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>Refuse report</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Skeleton width="100%" height={56} borderRadius={12} isDark={isDark} />
            <Skeleton width="100%" height={320} borderRadius={12} isDark={isDark} />
            <Skeleton width="100%" height={120} borderRadius={12} isDark={isDark} />
          </View>
        ) : !token ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: text, fontWeight: '800' }}>You must be logged in to view this post.</Text>
          </View>
        ) : !post ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: text, fontWeight: '800' }}>Post not found.</Text>
          </View>
        ) : (
          <FeedItem item={post} initialFocusCommentId={focusCommentId} />
        )}
      </ScrollView>
    </View>
  );
}

