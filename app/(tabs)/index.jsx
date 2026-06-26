import { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { useAppContext } from '@/context';
import StoriesTray from '@/components/feed/StoriesTray';
import FeedItem from '@/components/feed/FeedItem';
import CreatePost from '@/components/feed/CreatePost';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { assignUniqueFeedKeys } from '@/components/helpers/helpers';

export default function HomeScreen() {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Enhanced hardcoded posts
  const hardcodedPosts = [

    {
      id: 4,
      type: 'post',
      title: '📚 Workshop Announcement',
      description: 'Join us for an exciting workshop on modern web development next week! Limited spots available.',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      user: {
        name: 'Nabil SAKR',
        avatar: 'https://via.placeholder.com/40',
        image: null,
      },
      likes: 45,
      comments: 8,
      reposts: 7,
      isReposted: true,
      reposted: true,
      reposted_by: user?.name || 'You',
      image: 'https://via.placeholder.com/400x200',
    },
  ];

  useEffect(() => {
    if (token) {
      fetchFeed();
    } else {
      setPosts(hardcodedPosts);
      setLoading(false);
    }
  }, [token]);

  // Helper function to get avatar URL - match profile.jsx and notifications.jsx approach
  const getAvatarUrl = (avatar, image) => {
    // First try avatar (might be full URL from API)
    const avatarValue = avatar || image;
    
    if (!avatarValue) return null;
    
    // If it's already a full URL, return it
    if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
      return avatarValue;
    }
    
    if (typeof avatarValue === 'string') {
      // Check if it already includes storage path
      if (avatarValue.includes('storage/')) {
        const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
        return `${API.APP_URL}${cleanPath}`;
      } else {
        // If it's just a filename, use storage/img/profile/ like profile.jsx does
        return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
      }
    }
    
    return null;
  };

  const fetchFeed = async () => {
    if (!token) {
      setPosts(hardcodedPosts);
      setLoading(false);
      return;
    }
    
    try {
      console.log('[HOME] Fetching feed...');
      const response = await API.getWithAuth('mobile/feed', token);
      console.log('[HOME] Feed response:', JSON.stringify(response?.data, null, 2));
      
      if (response?.data) {
        // API returns { feed: [...] }, not { posts: [...] }
        const feedData = response.data.feed || response.data.posts || [];
        console.log('[HOME] Feed items found:', feedData.length);
        
        const feedPosts = assignUniqueFeedKeys(feedData.map(post => {
          // Get user avatar and image from various possible fields
          const userAvatar = post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
          const userImage = post.user?.image || post.author?.image || post.user_image || post.author_image;
          
          // Construct proper avatar URL using helper function
          const avatarUrl = getAvatarUrl(userAvatar, userImage);
          
          const normalizedUser = {
            ...(post.user || post.author || {}),
            name: post.user?.name || post.author?.name || post.user_name || post.author_name || 'Unknown',
            avatar: avatarUrl,
            image: userImage, // Keep original image value for reference
          };
          
          // Post image handling - check if it needs URL construction
          let normalizedImage = post.image || post.image_url || post.media?.url || (post.images && post.images[0]);
          
          // If post image is not a full URL, construct it
          if (normalizedImage && typeof normalizedImage === 'string' && !normalizedImage.startsWith('http')) {
            if (normalizedImage.includes('storage/')) {
              const cleanPath = normalizedImage.startsWith('/') ? normalizedImage : `/${normalizedImage}`;
              normalizedImage = `${API.APP_URL}${cleanPath}`;
            } else {
              // Assume it's in /storage/img/posts/
              normalizedImage = `${API.APP_URL}/storage/img/posts/${normalizedImage}`;
            }
          }
          
          // Log for debugging
          console.log('[HOME] Post normalized:', {
            id: post.id,
            userName: normalizedUser.name,
            userAvatar: avatarUrl,
            userImage: userImage,
            postImage: normalizedImage,
            originalPostImage: post.image || post.image_url,
            fullUserObject: normalizedUser
          });
          
          return {
            ...post,
            user: normalizedUser,
            userAvatar: avatarUrl,
            postImage: normalizedImage,
            image: normalizedImage, // Keep for backward compatibility
            onRepost: handleRepost,
          };
        }));
        setPosts(feedPosts);
      } else {
        // Fallback to hardcoded posts if no data
        setPosts(hardcodedPosts);
      }
    } catch (error) {
      console.error('[HOME] Error fetching feed:', error);
      // Fallback to hardcoded posts on error
      setPosts(hardcodedPosts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const handleRepost = async (post) => {
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    try {
      const wasReposted = Boolean(post?.isReposted || post?.is_reposted_by_user || post?.reposted);
      const endpoint = wasReposted ? 'mobile/posts/unrepost' : 'mobile/posts/repost';

      const response = await API.post(endpoint, { post_id: post.id }, token);

      if (response?.data) {
        const serverReposted = response?.data?.reposted;
        const serverCount = response?.data?.reposts_count;
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === post.id
              ? {
                  ...p,
                  isReposted: typeof serverReposted === 'boolean' ? serverReposted : !wasReposted,
                  reposted: typeof serverReposted === 'boolean' ? serverReposted : !wasReposted,
                  reposts: typeof serverCount === 'number'
                    ? Math.max(0, serverCount)
                    : Math.max(0, (p.reposts || 0) + (wasReposted ? -1 : 1)),
                  reposted_by: !wasReposted ? (user?.name || 'You') : (p.reposted_by ?? null),
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error('[HOME] Error reposting:', error);
      Alert.alert('Error', 'Failed to update repost. Please try again.');
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts(prevPosts =>
      assignUniqueFeedKeys([
        {
          ...newPost,
          onRepost: handleRepost,
        },
        ...prevPosts,
      ])
    );
  };

  return (
    <AppLayout showNavbar={true}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: isDark ? '#0f0f0f' : '#e9e5df' }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />
        }
      >
        {/* Stories tray (real data from /api/mobile/stories).
            We re-fetch on every pull-to-refresh by bumping refreshKey. */}
        <StoriesTray refreshKey={refreshing ? Date.now() : 0} />

        {/* Create Post card */}
        <View
          style={{
            backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
            marginBottom: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <CreatePost onPostPress={() => {}} onPostCreated={handlePostCreated} />
        </View>

        {/* Feed cards */}
        {loading ? (
          <View style={{ paddingTop: 10 }}>
            {Array.from({ length: 4 }).map((_, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                  marginBottom: 8,
                  borderTopWidth: 0.5,
                  borderBottomWidth: 0.5,
                  borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
                  paddingBottom: 14,
                }}
              >
                {/* Header skeleton */}
                <View style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <Skeleton width={42} height={42} borderRadius={21} isDark={isDark} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Skeleton width={160} height={12} borderRadius={8} isDark={isDark} />
                    <View style={{ height: 8 }} />
                    <Skeleton width={90} height={10} borderRadius={8} isDark={isDark} />
                  </View>
                </View>

                {/* Media skeleton */}
                <Skeleton width="100%" height={360} borderRadius={0} isDark={isDark} />

                {/* Action bar skeleton */}
                <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                      <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                      <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                    </View>
                    <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
                  </View>

                  <View style={{ height: 10 }} />
                  <Skeleton width={140} height={12} borderRadius={8} isDark={isDark} />
                  <View style={{ height: 10 }} />
                  <Skeleton width="92%" height={12} borderRadius={8} isDark={isDark} />
                  <View style={{ height: 8 }} />
                  <Skeleton width="70%" height={12} borderRadius={8} isDark={isDark} />
                </View>
              </View>
            ))}
          </View>
        ) : posts.length === 0 ? (
          <View
            style={{
              backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
              marginHorizontal: 0,
              paddingVertical: 48,
              alignItems: 'center',
            }}
          >
            <Ionicons name="document-text-outline" size={48} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
            <Text className="text-black/60 dark:text-white/60 text-center mt-4 px-4">
              No posts yet. Be the first to share something!
            </Text>
          </View>
        ) : (
          posts.map((item) => (
            <FeedItem
              key={item.feedKey ?? item.id}
              item={{
                ...item,
                onRepost: handleRepost,
                onPostDeleted: (postId) => {
                  setPosts(prev => prev.filter(p => p.id !== postId));
                },
              }}
            />
          ))
        )}
      </ScrollView>
    </AppLayout>
  );
}
