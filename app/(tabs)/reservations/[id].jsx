import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import API from '@/api';
import AppLayout from '@/components/layout/AppLayout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import { Colors } from '@/constants/Colors';
import Skeleton from '@/components/ui/Skeleton';

export default function ReservationDetails() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAppContext();

  useEffect(() => {
    const fetchReservation = async () => {
      try {
       
        const res = await API.getWithAuth(`mobile/reservations/${id}`, token);
        // console.log(res.data.reservation);
        
        setReservation(res.data.reservation);
      } catch (error) {
        console.error('Error fetching reservation:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchReservation();
  }, [id]);

  if (loading) return (
    <AppLayout>
      <View style={{ flex: 1, padding: 16 }}>
        <Skeleton width="78%" height={28} borderRadius={12} isDark={isDark} />
        <View style={{ height: 18 }} />
        <Skeleton width={210} height={30} borderRadius={999} isDark={isDark} />
        <View style={{ height: 22 }} />
        <Skeleton width="100%" height={180} borderRadius={16} isDark={isDark} />
        <View style={{ height: 16 }} />
        <Skeleton width="100%" height={220} borderRadius={16} isDark={isDark} />
      </View>
    </AppLayout>
  );

  if (!reservation) return (
    <AppLayout>
      <View className="flex-1 justify-center items-center px-4">
        <Text className={`text-center text-lg ${isDark ? 'text-light' : 'text-beta'} mt-8`}>Reservation not found</Text>
      </View>
    </AppLayout>
  );

  const getStatusStyles = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized.includes('approve') || normalized.includes('active')) {
      return {
        backgroundColor: isDark ? Colors.good + '33' : Colors.good + '1A',
        color: Colors.good,
        borderColor: Colors.good,
      };
    }
    if (normalized.includes('pending')) {
      return {
        backgroundColor: isDark ? Colors.alpha + '33' : Colors.alpha + '1A',
        color: Colors.alpha,
        borderColor: Colors.alpha,
      };
    }
    if (normalized.includes('reject') || normalized.includes('cancel')) {
      return {
        backgroundColor: isDark ? Colors.error + '33' : Colors.error + '1A',
        color: Colors.error,
        borderColor: Colors.error,
      };
    }
    return {
      backgroundColor: isDark ? Colors.dark_gray : Colors.light,
      color: isDark ? Colors.light : Colors.beta,
      borderColor: Colors.dark_gray,
    };
  };

  const baseUrl = (API?.APP_URL || '').replace(/\/+$/, '');

  const getImageUri = (item) => {
    if (!item) return null;
    if (typeof item === 'string') {
      const cleaned = item.trim().replace(/^@+/, '');
      if (!cleaned) return null;
      if (/^https?:\/\//i.test(cleaned)) {
        try {
          return encodeURI(cleaned);
        } catch {
          return cleaned;
        }
      }
      // Relative paths from API (e.g., "storage/..." or "img/...")
      const path = cleaned.replace(/^\/+/, '');
      if (path.startsWith('storage/')) {
        return `${baseUrl}/${path}`;
      }
      if (path.startsWith('img/')) {
        return `${baseUrl}/storage/${path}`;
      }
      return `${baseUrl}/${path}`;
    }
    if (typeof item === 'object') {
      return item.url || item.uri || item.image || item.image_url || item.path || null;
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
          <Text style={{ fontSize: size * 0.3, color: isDark ? Colors.light + '66' : Colors.beta + '66' }}>📷</Text>
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

  const getApproverName = (res) => {
    if (!res) return null;
    const c = (v) => (typeof v === 'string' ? v.trim() : v);
    const direct = c(res.approver_name) || c(res.approved_by) || c(res.approver) || c(res.approverName);
    if (direct && typeof direct === 'string' && direct.length > 0) return direct;
    if (res.approver && typeof res.approver === 'object') {
      const fromObj = c(res.approver.name) || c(res.approver.full_name) || c(res.approver.username);
      if (fromObj && typeof fromObj === 'string' && fromObj.length > 0) return fromObj;
    }
    return null;
  };

  return (
    <AppLayout>
      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text style={{ fontSize: 28, fontWeight: '700', color: isDark ? Colors.light : Colors.beta, marginBottom: 16 }}>{reservation.title || 'Reservation'}</Text>

          <View className="flex-row items-center gap-2 flex-wrap">
            {(() => {
              const statusStyle = getStatusStyles(reservation.status);
              return (
                <View style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  backgroundColor: statusStyle.backgroundColor,
                  borderColor: statusStyle.borderColor,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: statusStyle.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {reservation.status || 'Unknown'}
                  </Text>
                </View>
              );
            })()}
            {reservation.type ? (
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                backgroundColor: isDark ? Colors.alpha + '33' : Colors.alpha + '1A',
                borderColor: Colors.alpha,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.alpha, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {reservation.type}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Description */}
        {reservation.description && (
          <View className="mb-6">
            <View style={{
              backgroundColor: isDark ? Colors.dark_gray : Colors.light,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? Colors.dark : Colors.dark_gray,
              padding: 16,
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
              <Text style={{ fontSize: 15, color: isDark ? Colors.light : Colors.beta, lineHeight: 22 }}>{reservation.description}</Text>
            </View>
          </View>
        )}

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
          <View className="flex-row justify-between mb-4">
            <View className="flex-1 pr-3">
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>{reservation.day || 'N/A'}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: isDark ? Colors.dark : Colors.dark_gray }} />
            <View className="flex-1 px-3">
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Start</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>{reservation.start || 'N/A'}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: isDark ? Colors.dark : Colors.dark_gray }} />
            <View className="flex-1 pl-3">
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>End</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>{reservation.end || 'N/A'}</Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: isDark ? Colors.dark : Colors.dark_gray, marginVertical: 16 }} />

          <View className="flex-row gap-3 flex-wrap">
            {reservation.studio_name ? (
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: isDark ? Colors.dark : Colors.light,
                borderWidth: 1,
                borderColor: isDark ? Colors.dark : Colors.dark_gray,
                flex: 1,
                minWidth: 120,
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 4 }}>Studio</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>{reservation.studio_name}</Text>
              </View>
            ) : null}
            <View style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: isDark ? Colors.dark : Colors.light,
              borderWidth: 1,
              borderColor: isDark ? Colors.dark : Colors.dark_gray,
              flex: 1,
              minWidth: 120,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99', marginBottom: 4 }}>Approved by</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? Colors.light : Colors.beta }}>
                {getApproverName(reservation) || (String(reservation.status || '').toLowerCase().includes('pending') ? 'Pending' : '—')}
              </Text>
            </View>
          </View>
        </View>

        {/* Equipment */}
        <View className="mb-6">
          <Text className={`text-xl font-bold ${isDark ? 'text-light' : 'text-beta'} mb-4`}>Equipment</Text>
          {Array.isArray(reservation.equipments) && reservation.equipments.length > 0 ? (
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
              {reservation.equipments.map((eq, idx) => {
                const thumb = getImageUri(eq?.image);
                return (
                  <View key={eq.id ?? idx} className={`flex-row items-center justify-between py-3 border-b ${isDark ? 'border-dark' : 'border-beta/20'} last:border-b-0`}>
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <Thumbnail uri={thumb} size={56} radius={12} />
                      <Text className={`text-base font-semibold ${isDark ? 'text-light' : 'text-beta'} flex-1`} numberOfLines={1}>
                        {eq.name}
                      </Text>
                    </View>
                    <View className={`px-3 py-1.5 rounded-lg ${isDark ? 'bg-dark border-dark' : 'bg-light border-beta/20'} border`}>
                      <Text className={`text-xs font-semibold ${isDark ? 'text-light/80' : 'text-beta/80'}`}>{eq.type_name}</Text>
                    </View>
                  </View>
                );
              })}
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
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔧</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99' }}>No equipment listed</Text>
            </View>
          )}
        </View>

        {/* Attachments / Images */}
        {Array.isArray(reservation.images) && reservation.images.length > 0 ? (
          <View className="mb-6">
            <Text className={`text-xl font-bold ${isDark ? 'text-light' : 'text-beta'} mb-4`}>Images</Text>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {reservation.images.map((img, idx) => {
                  const uri = getImageUri(img);
                  if (!uri) return null;
                  return (
                    <View key={idx} style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: isDark ? Colors.dark : Colors.light,
                      borderWidth: 1,
                      borderColor: isDark ? Colors.dark : Colors.dark_gray,
                      height: 180,
                      width: 240,
                      shadowColor: Colors.dark,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                    }}>
                      <Thumbnail uri={uri} size={180} radius={12} />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {/* Team Members */}
        <View className="mb-6">
          <Text className={`text-xl font-bold ${isDark ? 'text-light' : 'text-beta'} mb-4`}>Team Members</Text>
          {Array.isArray(reservation.members) && reservation.members.length > 0 ? (
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
              {reservation.members.map((member, idx) => (
                <View key={`${member.email}-${idx}`} className={`flex-row items-center justify-between py-3 border-b ${isDark ? 'border-dark' : 'border-beta/20'} last:border-b-0`}>
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <Thumbnail uri={member.avatar} size={48} radius={999} />
                    <Text className={`text-base font-semibold ${isDark ? 'text-light' : 'text-beta'} flex-1`} numberOfLines={1}>{member.name}</Text>
                  </View>
                  <View className={`px-3 py-1.5 rounded-lg ${isDark ? 'bg-dark border-dark' : 'bg-light border-beta/20'} border`}>
                    <Text className={`text-xs font-semibold ${isDark ? 'text-light/80' : 'text-beta/80'}`}>{member.role}</Text>
                  </View>
                </View>
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
              <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? Colors.light + '99' : Colors.beta + '99' }}>No team members listed</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </AppLayout>
  );
}
