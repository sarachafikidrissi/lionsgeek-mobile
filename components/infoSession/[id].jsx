import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Image, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import { InfoSessionAPI } from '@/api/infoSessionSection';
import AppLayout from '@/components/layout/AppLayout';
import AccessDenied from '@/components/events/partials/AccessDenied';
import Skeleton from '@/components/ui/Skeleton';
import { Colors, getAccentFillColor, getAccentIconColor, getOnAccentTextColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  findParticipantById,
  formatSessionDate,
  getParticipantDetailRows,
  getParticipantPhotoUrl,
  isParticipantCheckedIn,
  mapInfoParticipant,
  mapInfoParticipants,
} from '@/components/infoSession/helpers';

function SectionCard({ children, className = '' }) {
  return (
    <View
      className={`bg-light dark:bg-dark_gray border border-beta/8 dark:border-light/8 rounded-2xl overflow-hidden ${className}`}
    >
      {children}
    </View>
  );
}

function DetailRow({ icon, label, value, accentIcon }) {
  return (
    <View className="flex-row items-start gap-3 py-3 border-b border-beta/6 dark:border-light/6 last:border-b-0">
      <View className="w-9 h-9 rounded-xl bg-beta/12 dark:bg-alpha/12 items-center justify-center mt-0.5">
        <Ionicons name={icon} size={16} color={accentIcon} />
      </View>
      <View className="flex-1 min-w-0">
        <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">
          {label}
        </Text>
        <Text className="text-sm font-medium text-beta dark:text-light mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

export default function ParticipantDetail() {
  const { user } = useAppContext();
  const params = useLocalSearchParams();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const participantId = Array.isArray(params.id) ? params.id[0] : params.id;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const accentFill = getAccentFillColor(isDark);
  const onAccentText = getOnAccentTextColor(isDark);

  const [participant, setParticipant] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState(null);

  const detailRows = useMemo(() => getParticipantDetailRows(participant), [participant]);
  const photoUrl = useMemo(() => getParticipantPhotoUrl(participant?.image), [participant?.image]);
  const checkedIn = isParticipantCheckedIn(participant);

  const loadParticipant = useCallback(
    async (isRefresh = false) => {
      if (!sessionId || !participantId) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [sessionResponse, profileResponse] = await Promise.all([
          InfoSessionAPI.getSessionData(sessionId),
          InfoSessionAPI.getProfileData(participantId).catch(() => null),
        ]);

        const session = sessionResponse?.data?.session ?? null;
        const participants = mapInfoParticipants(sessionResponse?.data?.participants);
        let match = findParticipantById(participants, participantId);

        if (profileResponse?.data) {
          const fromProfile = mapInfoParticipant(profileResponse.data);
          match = match ? { ...match, ...fromProfile } : fromProfile;
        }

        if (!match) {
          setError('Participant not found for this session.');
          setParticipant(null);
          setCurrentSession(null);
          return;
        }

        setCurrentSession(session);
        setParticipant(match);
      } catch (err) {
        console.error('[SCAN] Info session participant detail error:', err);
        setError('Could not load participant details.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sessionId, participantId]
  );

  const uploadPhoto = useCallback(
    async (asset) => {
      if (!participantId || !asset?.uri) return;

      setUploadingPhoto(true);
      try {
        const photoFile = {
          uri: asset.uri,
          name: asset.fileName ?? `participant-${participantId}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        };

        const response = await InfoSessionAPI.uploadSessionPhoto(participantId, photoFile);
        const updated = mapInfoParticipant(response?.data?.profile);
        if (updated) {
          setParticipant((prev) => ({ ...prev, ...updated }));
        }
      } catch (err) {
        console.error('[SCAN] Participant photo upload error:', err);
        Alert.alert('Upload failed', 'Could not save the participant photo. Please try again.');
      } finally {
        setUploadingPhoto(false);
      }
    },
    [participantId]
  );

  const handleTakePhoto = useCallback(async () => {
    if (uploadingPhoto) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access to take a participant photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await uploadPhoto(result.assets[0]);
  }, [uploadingPhoto, uploadPhoto]);

  const handleManualCheckIn = useCallback(async () => {
    if (!participantId || checkingIn || checkedIn) return;

    Alert.alert(
      'Manual check-in',
      'Mark this participant as checked in without scanning their QR code?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check in',
          onPress: async () => {
            setCheckingIn(true);
            try {
              const response = await InfoSessionAPI.manualChecking(participantId);
              const updated = mapInfoParticipant(response?.data?.profile);
              if (updated) {
                setParticipant((prev) => ({ ...prev, ...updated, is_visited: true }));
              } else {
                setParticipant((prev) => (prev ? { ...prev, is_visited: true } : prev));
              }
            } catch (err) {
              console.error('[SCAN] Manual check-in error:', err);
              Alert.alert('Check-in failed', 'Could not mark this participant as checked in.');
            } finally {
              setCheckingIn(false);
            }
          },
        },
      ]
    );
  }, [participantId, checkingIn, checkedIn]);

  useEffect(() => {
    loadParticipant();
  }, [loadParticipant]);

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  const sessionTitle = currentSession?.name || 'Info Session';
  const initial = (participant?.name || '?').charAt(0).toUpperCase();

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View className="pt-12 pb-3 px-4 flex-row items-center gap-2 border-b border-beta/8 dark:border-light/8">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-xl bg-beta/15 dark:bg-alpha/15 items-center justify-center active:opacity-70"
          >
            <Ionicons name="arrow-back" size={20} color={accentIcon} />
          </Pressable>
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
              Participant
            </Text>
            {loading ? (
              <Skeleton width={140} height={16} borderRadius={6} isDark={isDark} />
            ) : (
              <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={1}>
                {participant?.name || 'Participant'}
              </Text>
            )}
          </View>
          {!loading && !error ? (
            <Pressable
              onPress={handleTakePhoto}
              disabled={uploadingPhoto}
              accessibilityLabel={photoUrl ? 'Retake participant photo' : 'Take participant photo'}
              className="w-10 h-10 rounded-xl bg-beta dark:bg-alpha items-center justify-center active:opacity-80"
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={onAccentText} />
              ) : (
                <Ionicons name="camera" size={20} color={onAccentText} />
              )}
            </Pressable>
          ) : (
            <View className="w-10 h-10" />
          )}
        </View>

        {loading ? (
          <View className="p-4 gap-4">
            <Skeleton width="100%" height={120} borderRadius={20} isDark={isDark} />
            <Skeleton width="100%" height={160} borderRadius={16} isDark={isDark} />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
            <Text className="text-base font-semibold text-beta dark:text-light text-center mt-3">{error}</Text>
            <Pressable
              onPress={() => loadParticipant()}
              className="mt-6 flex-row items-center gap-2 bg-beta dark:bg-alpha px-6 py-3.5 rounded-2xl active:opacity-90"
            >
              <Ionicons name="refresh" size={18} color={onAccentText} />
              <Text className="text-light dark:text-beta font-bold">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 pb-10 gap-4"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadParticipant(true)}
                tintColor={accentFill}
                colors={[accentFill]}
              />
            }
          >
            <SectionCard className="p-4 items-center">
              <View className="w-24 h-24 rounded-full overflow-hidden bg-beta/15 dark:bg-alpha/15 items-center justify-center mb-3 border-2 border-beta/10 dark:border-light/10">
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <Text className="text-3xl font-bold text-beta dark:text-alpha">{initial}</Text>
                )}
              </View>
              <Text className="text-xl font-bold text-beta dark:text-light text-center">{participant?.name}</Text>
              <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-1">{participant?.email}</Text>

              {!photoUrl ? (
                <Text className="text-xs text-beta/45 dark:text-light/45 text-center mt-2 px-4">
                  Tap the camera icon above to take a check-in photo.
                </Text>
              ) : null}

              <View className="flex-row flex-wrap items-center justify-center gap-2 mt-4">
                {checkedIn ? (
                  <View className="flex-row items-center gap-1.5 bg-good/15 px-3 py-1.5 rounded-full">
                    <Ionicons name="qr-code" size={14} color={Colors.good} />
                    <Text className="text-xs font-bold text-good">Checked in</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1.5 bg-beta/10 dark:bg-light/10 px-3 py-1.5 rounded-full">
                    <Ionicons name="hourglass-outline" size={14} color={isDark ? Colors.light : Colors.beta} />
                    <Text className="text-xs font-bold text-beta/55 dark:text-light/55">Not checked in yet</Text>
                  </View>
                )}
              </View>

              {!checkedIn ? (
                <Pressable
                  onPress={handleManualCheckIn}
                  disabled={checkingIn}
                  className="mt-4 flex-row items-center justify-center gap-2 w-full bg-beta dark:bg-alpha px-5 py-3.5 rounded-2xl active:opacity-90"
                >
                  {checkingIn ? (
                    <ActivityIndicator size="small" color={onAccentText} />
                  ) : (
                    <Ionicons name="person-add-outline" size={18} color={onAccentText} />
                  )}
                  <Text className="text-light dark:text-beta font-bold">
                    {checkingIn ? 'Checking in…' : 'Manual check-in'}
                  </Text>
                </Pressable>
              ) : null}

              {sessionTitle ? (
                <Text className="text-xs text-beta/45 dark:text-light/45 text-center mt-3 capitalize">
                  Registered for {sessionTitle}
                </Text>
              ) : null}
              {currentSession ? (
                <Text className="text-xs text-beta/45 dark:text-light/45 text-center mt-1">
                  {formatSessionDate(currentSession)}
                </Text>
              ) : null}
            </SectionCard>

            <SectionCard className="px-4">
              <Text className="text-sm font-bold text-beta dark:text-light pt-4 pb-1">Details</Text>
              <DetailRow icon="mail-outline" label="Email" value={participant?.email || '—'} accentIcon={accentIcon} />
              {detailRows.map((row) => (
                <DetailRow
                  key={`${row.label}-${row.value}`}
                  icon="information-circle-outline"
                  label={row.label}
                  value={row.value}
                  accentIcon={accentIcon}
                />
              ))}
              {!detailRows.length ? (
                <Text className="text-xs text-beta/45 dark:text-light/45 py-3">
                  No additional profile fields from the registration.
                </Text>
              ) : null}
            </SectionCard>
          </ScrollView>
        )}
      </View>
    </AppLayout>
  );
}
