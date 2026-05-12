import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Pressable } from 'react-native';
import { useAppContext } from '@/context';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

export default function MembersScreen() {
  const { user: currentUser, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if current user is admin
  const currentUserRoles = currentUser?.roles || [];
  const isAdmin = currentUserRoles.some(r => ['admin', 'coach'].includes(r?.toLowerCase?.() || r));

  useEffect(() => {
    const fetchMembers = async () => {
      if (!token) return;
      
      try {
        const response = await API.getWithAuth('users', token);
        setMembers(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        console.error('[MEMBERS] Error:', error);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    if (token && isAdmin) {
      fetchMembers();
    } else {
      setLoading(false);
    }
  }, [token, isAdmin]);

  const handleUserPress = (userId) => {
    router.push(`/(tabs)/profile?userId=${userId}`);
  };

  const getImageUrl = (user) => {
    if (user?.avatar) return user.avatar;
    if (user?.image) {
      if (user.image.startsWith('http')) {
        return user.image;
      }
      return `${API.APP_URL}/storage/img/profile/${user.image}`;
    }
    return null;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (!isAdmin) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 bg-light dark:bg-dark justify-center items-center px-6">
          <Ionicons name="lock-closed" size={64} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
          <Text className="text-lg font-semibold text-black dark:text-white mt-4 text-center">
            Access Denied
          </Text>
          <Text className="text-sm text-black/60 dark:text-white/60 mt-2 text-center">
            You need admin privileges to view all members
          </Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View className="bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 pt-12 pb-4 px-6">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-black dark:text-white flex-1">All Members</Text>
          </View>
        </View>

        {/* Members List */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
          {loading ? (
            <View>
              {Array.from({ length: 10 }).map((_, idx) => (
                <View
                  key={idx}
                  style={{
                    marginBottom: 12,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Skeleton width={48} height={48} borderRadius={24} isDark={isDark} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Skeleton width={170} height={12} borderRadius={10} isDark={isDark} />
                    <View style={{ height: 8 }} />
                    <Skeleton width={220} height={10} borderRadius={10} isDark={isDark} />
                    <View style={{ height: 10 }} />
                    <View style={{ flexDirection: 'row' }}>
                      <Skeleton width={54} height={16} borderRadius={999} isDark={isDark} />
                      <View style={{ width: 8 }} />
                      <Skeleton width={44} height={16} borderRadius={999} isDark={isDark} />
                    </View>
                  </View>
                  <View style={{ width: 18, height: 18, opacity: 0.5 }}>
                    <Skeleton width={18} height={18} borderRadius={9} isDark={isDark} />
                  </View>
                </View>
              ))}
            </View>
          ) : members.length === 0 ? (
            <View className="flex-1 justify-center items-center py-20">
              <Ionicons name="people-outline" size={64} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
              <Text className="text-lg font-semibold text-black dark:text-white mt-4">No members found</Text>
            </View>
          ) : (
            <>
              <Text className="text-sm text-black/60 dark:text-white/60 mb-4">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Text>
              {members.map((member) => {
                const imageUrl = getImageUrl(member);
                const initials = getInitials(member.name || member.username);

                return (
                  <Pressable
                    key={member.id}
                    onPress={() => handleUserPress(member.id)}
                    className="mb-3 bg-light dark:bg-dark rounded-lg p-4 border border-light/20 dark:border-dark/20 flex-row items-center active:opacity-70"
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        className="w-12 h-12 rounded-full mr-3"
                        defaultSource={require('@/assets/images/icon.png')}
                      />
                    ) : (
                      <View className="w-12 h-12 rounded-full mr-3 bg-alpha/20 justify-center items-center">
                        <Text className="text-base font-semibold text-alpha">
                          {initials}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-black dark:text-white">
                        {member.name || member.username || 'Unknown'}
                      </Text>
                      {userHasAdminRole(currentUser) && member.email ? (
                        <Text className="text-sm text-black/60 dark:text-white/60">
                          {member.email}
                        </Text>
                      ) : null}
                      <View className="flex-row items-center mt-1">
                        {member.promo && (
                          <Text className="text-xs text-black/50 dark:text-white/50 mr-2">
                            {member.promo}
                          </Text>
                        )}
                        {member.roles && member.roles.length > 0 && (
                          <View className="flex-row">
                            {member.roles.slice(0, 2).map((role, idx) => (
                              <View key={idx} className="px-2 py-0.5 rounded-full bg-alpha/20 mr-1">
                                <Text className="text-xs font-medium text-alpha capitalize">
                                  {role}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </AppLayout>
  );
}

