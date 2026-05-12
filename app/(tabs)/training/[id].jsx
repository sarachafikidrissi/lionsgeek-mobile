import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import API from '@/api';
import AppLayout from '@/components/layout/AppLayout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

export default function TrainingDetails() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token, user: currentUser } = useAppContext();
  const showUserEmails = userHasAdminRole(currentUser);

  useEffect(() => {
    const fetchTraining = async () => {
      try {
        const res = await API.getWithAuth(`mobile/trainings/${id}`, token);
        setTraining(res.data.training);
      } catch (error) {
        console.error('Error fetching training:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id && token) fetchTraining();
  }, [id, token]);

  if (loading) return (
    <AppLayout>
      <View style={{ flex: 1, padding: 16 }}>
        <Skeleton width="100%" height={200} borderRadius={16} isDark={isDark} />
        <View style={{ height: 16 }} />
        <Skeleton width="78%" height={28} borderRadius={12} isDark={isDark} />
        <View style={{ height: 16 }} />
        <Skeleton width={140} height={30} borderRadius={999} isDark={isDark} />
        <View style={{ height: 22 }} />
        <Skeleton width="100%" height={220} borderRadius={16} isDark={isDark} />
      </View>
    </AppLayout>
  );

  if (!training) return (
    <AppLayout>
      <View className="flex-1 justify-center items-center px-4">
        <Text className={`text-center text-lg ${isDark ? 'text-light' : 'text-beta'} mt-8`}>Training not found</Text>
      </View>
    </AppLayout>
  );

  const getImageUri = (img) => {
    if (!img) return null;
    if (typeof img === 'string') {
      if (/^https?:\/\//i.test(img)) return img;
      return `${API.APP_URL || ''}/${img.replace(/^\/+/, '')}`;
    }
    return null;
  };

  const Thumbnail = ({ uri, size = 48, radius = 12 }) => {
    const [hasError, setHasError] = useState(false);
    const normalized = getImageUri(uri);
    if (!normalized || hasError) {
      return (
        <View
          style={{ 
            height: size, 
            width: size, 
            borderRadius: radius,
            backgroundColor: isDark ? Colors.dark : Colors.dark_gray,
            borderWidth: 1,
            borderColor: isDark ? Colors.dark_gray : Colors.dark_gray,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="person" size={size * 0.5} color={isDark ? Colors.light + '66' : Colors.beta + '66'} />
        </View>
      );
    }
    return (
      <Image
        source={{ uri: normalized }}
        style={{ height: size, width: size, borderRadius: radius }}
        resizeMode="cover"
        onError={() => setHasError(true)}
      />
    );
  };

  return (
    <AppLayout>
      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          {training.img && (
            <Image
              source={{ uri: getImageUri(training.img) }}
              style={styles.headerImage(isDark)}
              resizeMode="cover"
            />
          )}
          <Text style={{ fontSize: 28, fontWeight: '700', color: isDark ? Colors.light : Colors.beta, marginTop: 16, marginBottom: 16 }}>
            {training.name || 'Training'}
          </Text>

          <View className="flex-row items-center gap-2 flex-wrap">
            {training.category && (
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                backgroundColor: isDark ? Colors.alpha + '33' : Colors.alpha + '1A',
                borderColor: Colors.alpha,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.alpha, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {training.category}
                </Text>
              </View>
            )}
            {training.promo && (
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                backgroundColor: isDark ? Colors.dark_gray : Colors.light,
                borderColor: isDark ? Colors.dark : Colors.dark_gray,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? Colors.light : Colors.beta, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {training.promo}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={{
          backgroundColor: isDark ? Colors.dark_gray : Colors.light,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: isDark ? Colors.dark : Colors.dark_gray,
          padding: 20,
          marginBottom: 24,
          shadowColor: Colors.dark,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          {training.coach && (
            <View className="mb-4">
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Coach</Text>
              <View className="flex-row items-center gap-3">
                <Thumbnail uri={training.coach.image} size={48} radius={999} />
                <View className="flex-1">
                  <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>{training.coach.name}</Text>
                  {showUserEmails && training.coach.email ? (
                    <Text style={{ fontSize: 13, color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC', marginTop: 2 }}>{training.coach.email}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 1, backgroundColor: isDark ? Colors.dark : Colors.dark_gray, marginVertical: 16 }} />

          <View className="flex-row justify-between mb-4">
            {training.start_time && (
              <View className="flex-1 pr-3">
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Start Date</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>
                  {new Date(training.start_time).toLocaleDateString()}
                </Text>
              </View>
            )}
            {training.end_time && (
              <>
                <View style={{ width: 1, backgroundColor: isDark ? Colors.dark : Colors.dark_gray }} />
                <View className="flex-1 pl-3">
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>End Date</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>
                    {new Date(training.end_time).toLocaleDateString()}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Attendance Button */}
        {training.users && training.users.length > 0 && (
          <View className="mb-6">
            <Pressable
              onPress={() => router.push({ pathname: '/training/attendance', params: { id: training.id } })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                backgroundColor: Colors.alpha,
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderRadius: 16,
                shadowColor: Colors.alpha,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Ionicons name="calendar-outline" size={24} color={Colors.light} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.light }}>
                Take Attendance
              </Text>
            </Pressable>
          </View>
        )}

        {/* Students */}
        <View className="mb-6">
          <Text className={`text-xl font-bold ${isDark ? 'text-light' : 'text-beta'} mb-4`}>
            Students ({training.users?.length || 0})
          </Text>
          {Array.isArray(training.users) && training.users.length > 0 ? (
            <View style={{
              backgroundColor: isDark ? Colors.dark_gray : Colors.light,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? Colors.dark : Colors.dark_gray,
              padding: 16,
              shadowColor: Colors.dark,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}>
              {training.users.map((user, idx) => (
                <Pressable
                  key={user.id || idx}
                  onPress={() => router.push(`/(tabs)/profile?userId=${user.id}`)}
                  className={`flex-row items-center justify-between py-3 border-b ${isDark ? 'border-dark' : 'border-beta/20'} last:border-b-0`}
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <Thumbnail uri={user.image} size={48} radius={999} />
                    <View className="flex-1">
                      <Text className={`text-base font-semibold ${isDark ? 'text-light' : 'text-beta'}`} numberOfLines={1}>{user.name}</Text>
                      {showUserEmails && user.email ? (
                        <Text className={`text-sm ${isDark ? 'text-light/60' : 'text-beta/60'}`} numberOfLines={1}>{user.email}</Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{
              backgroundColor: isDark ? Colors.dark_gray : Colors.light,
              borderRadius: 12,
              padding: 24,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: isDark ? Colors.dark : Colors.dark_gray,
              borderStyle: 'dashed',
            }}>
              <Ionicons name="people-outline" size={32} color={isDark ? Colors.light + '66' : Colors.beta + '66'} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginTop: 8 }}>No students enrolled</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  headerImage: (isDark) => ({
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
  }),
});
