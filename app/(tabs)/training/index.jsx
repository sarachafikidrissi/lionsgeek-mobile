import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';

export default function Training() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchTrainings = useCallback(async () => {
    if (!token) return;
    try {
      const response = await API.getWithAuth('mobile/trainings', token);
      if (response?.data) {
        const data = response.data.trainings || [];
        setTrainings(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('[TRAINING] Fetch Error:', error);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchTrainings().finally(() => setLoading(false));
    }
  }, [token, fetchTrainings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrainings();
    setRefreshing(false);
  }, [fetchTrainings]);

  const getImageUrl = (img) => {
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return `${API.APP_URL || ''}/${img.replace(/^\/+/, '')}`;
  };

  if (loading) {
    return (
      <AppLayout>
        <View className="flex-1 bg-light dark:bg-dark" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Skeleton width={180} height={28} borderRadius={12} isDark={isDark} />
          <View style={{ height: 10 }} />
          <Skeleton width={260} height={14} borderRadius={10} isDark={isDark} />
          <View style={{ height: 22 }} />

          {Array.from({ length: 3 }).map((_, idx) => (
            <View
              key={idx}
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                marginBottom: 16,
                borderWidth: 1,
                borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
              }}
            >
              <Skeleton width="100%" height={180} borderRadius={0} isDark={isDark} />
              <View style={{ padding: 16 }}>
                <Skeleton width="85%" height={18} borderRadius={10} isDark={isDark} />
                <View style={{ height: 10 }} />
                <Skeleton width={120} height={18} borderRadius={999} isDark={isDark} />
                <View style={{ height: 14 }} />
                <Skeleton width="75%" height={12} borderRadius={10} isDark={isDark} />
                <View style={{ height: 10 }} />
                <Skeleton width="55%" height={12} borderRadius={10} isDark={isDark} />
              </View>
            </View>
          ))}
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ScrollView
        className="flex-1 bg-light dark:bg-dark"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.alpha}
            colors={[Colors.alpha]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle(isDark)}>Trainings</Text>
            <Text style={styles.headerSubtitle(isDark)}>
              View and manage your training programs
            </Text>
          </View>
        </View>

        {/* Trainings List */}
        {trainings.length === 0 ? (
          <View style={styles.emptyContainer(isDark)}>
            <Ionicons name="school-outline" size={48} color={isDark ? Colors.light + '50' : Colors.beta + '50'} />
            <Text style={styles.emptyText(isDark)}>
              No trainings available
            </Text>
          </View>
        ) : (
          <View style={styles.trainingsList}>
            {trainings.map((training) => {
              const imageUrl = getImageUrl(training.img);
              return (
                <Pressable
                  key={training.id}
                  onPress={() => router.push({ pathname: '/training/[id]', params: { id: training.id } })}
                  style={({ pressed }) => [
                    styles.trainingCard(isDark),
                    pressed && styles.trainingCardPressed,
                  ]}
                >
                  {/* Image Section */}
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.trainingImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.trainingImagePlaceholder}>
                      <Ionicons name="school-outline" size={40} color={Colors.alpha} />
                    </View>
                  )}

                  {/* Content Section */}
                  <View style={styles.trainingContent}>
                    <Text style={styles.trainingName(isDark)} numberOfLines={2}>
                      {training.name}
                    </Text>
                    
                    {training.category && (
                      <View style={styles.categoryBadge(isDark)}>
                        <Text style={styles.categoryText(isDark)}>{training.category}</Text>
                      </View>
                    )}

                    <View style={styles.trainingInfo}>
                      {training.coach && (
                        <View style={styles.infoRow}>
                          <Ionicons name="person-outline" size={14} color={isDark ? Colors.light + 'CC' : Colors.beta + 'CC'} />
                          <Text style={styles.infoText(isDark)} numberOfLines={1}>
                            {training.coach.name}
                          </Text>
                        </View>
                      )}
                      
                      {training.users_count !== undefined && (
                        <View style={styles.infoRow}>
                          <Ionicons name="people-outline" size={14} color={isDark ? Colors.light + 'CC' : Colors.beta + 'CC'} />
                          <Text style={styles.infoText(isDark)}>
                            {training.users_count} {training.users_count === 1 ? 'student' : 'students'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {training.start_time && (
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={14} color={Colors.alpha} />
                        <Text style={styles.dateText(isDark)}>
                          {new Date(training.start_time).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerTitle: (isDark) => ({
    fontSize: 34,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
    letterSpacing: -0.8,
    marginBottom: 4,
  }),
  headerSubtitle: (isDark) => ({
    fontSize: 15,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '500',
  }),
  trainingsList: {
    gap: 16,
  },
  trainingCard: (isDark) => ({
    width: '100%',
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: Colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark_gray : Colors.dark_gray + '20',
  }),
  trainingCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  trainingImage: {
    width: '100%',
    height: 180,
  },
  trainingImagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.alpha + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingContent: {
    padding: 16,
  },
  trainingName: (isDark) => ({
    fontSize: 20,
    fontWeight: '800',
    color: isDark ? Colors.light : Colors.beta,
    marginBottom: 12,
    lineHeight: 26,
  }),
  categoryBadge: (isDark) => ({
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: isDark ? Colors.dark : Colors.alpha + '15',
    marginBottom: 12,
  }),
  categoryText: (isDark) => ({
    fontSize: 12,
    fontWeight: '700',
    color: Colors.alpha,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }),
  trainingInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: (isDark) => ({
    fontSize: 14,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '500',
    flex: 1,
  }),
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark_gray + '30',
  },
  dateText: (isDark) => ({
    fontSize: 13,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '600',
  }),
  emptyContainer: (isDark) => ({
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: isDark ? Colors.dark_gray : Colors.light,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? Colors.dark : Colors.dark_gray + '20',
  }),
  emptyText: (isDark) => ({
    marginTop: 16,
    fontSize: 16,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    fontWeight: '500',
  }),
});
