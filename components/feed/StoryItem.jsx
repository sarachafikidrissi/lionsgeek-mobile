import { View, Text, Pressable, Image } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

export default function StoryItem({ user, isOwn = false, onPress }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const avatarUrl = resolveAvatarUrl(user?.avatar || user?.image);
  const displayName = isOwn ? 'Your story' : (user?.name || 'User');
  const initial = (user?.name || 'U').charAt(0).toUpperCase();

  return (
    <Pressable onPress={onPress} className="items-center active:opacity-70" style={{ width: 76, marginRight: 12 }}>
      {/* Instagram-style gradient ring: yellow/gold */}
      <View
        style={{
          width: 72, height: 72, borderRadius: 36,
          padding: 2.5,
          // Gold ring for own story; gradient-like for others
          backgroundColor: isOwn ? '#ffc801' : 'transparent',
          borderWidth: isOwn ? 0 : 2.5,
          borderColor: isOwn ? 'transparent' : '#ffc801',
        }}
      >
        {/* White gap ring */}
        <View
          style={{
            flex: 1, borderRadius: 33,
            backgroundColor: isDark ? '#171717' : '#fafafa',
            padding: 2,
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              defaultSource={require('@/assets/images/icon.png')}
              style={{ width: '100%', height: '100%', borderRadius: 29 }}
            />
          ) : (
            <View
              style={{ flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }}
              className="bg-beta/10 dark:bg-beta/40"
            >
              <Text className="font-extrabold text-base text-black/70 dark:text-white/70">
                {initial}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* "+" badge for own story */}
      {isOwn ? (
        <View
          style={{
            position: 'absolute', bottom: 22, right: 2,
            width: 20, height: 20, borderRadius: 10,
            backgroundColor: '#ffc801',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2,
            borderColor: isDark ? '#171717' : '#fafafa',
          }}
        >
          <Ionicons name="add" size={12} color="#000" />
        </View>
      ) : null}

      <Text
        numberOfLines={1}
        style={{ marginTop: 6, fontSize: 11, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)', maxWidth: 70, textAlign: 'center' }}
      >
        {displayName}
      </Text>
    </Pressable>
  );
}
