import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import { Home as LogoIcon } from '@/components/logo';

export default function Navbar() {
  const { user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleProfilePress = () => {
    router.push('/(tabs)/profile');
  };

  const handleSearchPress = () => {
    router.push('/(tabs)/search');
  };

  const handleChatPress = () => {
    router.push('/chat');
  };

  const handleNotificationsPress = () => {
    router.push('/(tabs)/notifications');
  };

  // Log user data for debugging
  // console.log('[NAVBAR] User data:', JSON.stringify(user, null, 2));

  // Helper function to get avatar URL - always use /storage/img/profile/
  const getAvatarUrl = () => {
    if (!user) return null;

    const avatar = user?.avatar;
    const image = user?.image;

    // First try avatar (might be full URL from API)
    const avatarValue = avatar || image;

    if (!avatarValue) return null;

    // If it's already a full URL, check if it needs to be corrected
    if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
      // If it's a full URL but doesn't include img/profile/, extract filename and reconstruct
      if (avatarValue.includes('/storage/') && !avatarValue.includes('/storage/img/profile/')) {
        // Extract filename from URL (e.g., from http://.../storage/filename.jpg)
        const filename = avatarValue.split('/').pop();
        if (filename) {
          return `${API.APP_URL}/storage/img/profile/${filename}`;
        }
      }
      return avatarValue;
    }

    if (typeof avatarValue === 'string') {
      // If it includes storage/ but not img/profile/, extract filename
      if (avatarValue.includes('storage/') && !avatarValue.includes('img/profile/')) {
        // Extract filename (handle both /storage/filename.jpg and storage/filename.jpg)
        const parts = avatarValue.split('/');
        const filename = parts[parts.length - 1];
        if (filename) {
          return `${API.APP_URL}/storage/img/profile/${filename}`;
        }
      }
      // If it already includes img/profile/, use it as is
      if (avatarValue.includes('img/profile/')) {
        const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
        return `${API.APP_URL}${cleanPath}`;
      }
      // If it's just a filename, use storage/img/profile/
      return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
    }

    return null;
  };

  // Early return if user is not loaded yet
  if (!user) {
    return (
      <View className={`bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 px-6 pt-12 pb-4`}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full mr-3 bg-gray-300 dark:bg-gray-700" />
            <View className="flex-1">
              <Text className="text-base font-semibold text-black dark:text-white" numberOfLines={1}>
                Loading...
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={`bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 px-6 pt-12 pb-4`}>
      <View className="flex-row items-center justify-between">
        {/* <TouchableOpacity 
          onPress={handleProfilePress}
          className="flex-row items-center flex-1"
        >
          {(() => {
            const profileImageUrl = getAvatarUrl();
            
            console.log('[Navbar] Profile image URL:', profileImageUrl, 'for user:', user?.name, 'avatar:', user?.avatar, 'image:', user?.image);
            
            return profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                className="w-10 h-10 rounded-full mr-3 border-2 border-alpha/30"
                defaultSource={require('@/assets/images/icon.png')}
                onError={(error) => {
                  console.log('[Navbar] Error loading profile image:', profileImageUrl, error);
                }}
                onLoad={() => {
                  console.log('[Navbar] Profile image loaded successfully:', profileImageUrl);
                }}
              />
            ) : (
              <View className="w-10 h-10 rounded-full mr-3 bg-gray-300 dark:bg-gray-700 items-center justify-center">
                <Text className="text-xs font-bold text-black/60 dark:text-white/60">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            );
          })()}
          <View className="flex-1">
            <Text className="text-base font-semibold text-black dark:text-white" numberOfLines={1}>
              {user?.name || 'User'}
            </Text>
            <Text className="text-xs text-black/60 dark:text-white/60" numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
        </TouchableOpacity> */}
        <View className="flex-row items-center  ">
          {/* :: Logo here */}
          <LogoIcon color={isDark ? '#fff' : '#000'} width={30} height={30} />
          {/* <Text className="text-xl font-semibold text-black dark:text-white mb-1">LionsGeek</Text> */}
        </View>

        <View className="flex-row items-center">
          <TouchableOpacity className="mr-4" onPress={handleSearchPress}>
            <Ionicons name="search-outline" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <TouchableOpacity className="mr-4" onPress={handleChatPress}>
            <Ionicons name="chatbubbles-outline" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNotificationsPress}>
            <Ionicons name="notifications-outline" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

