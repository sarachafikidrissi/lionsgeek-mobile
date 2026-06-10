import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Alert, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EventsInfoAPI from '@/api/eventsInfoSection';
import Skeleton from '@/components/ui/Skeleton';
import { getEventDisplayName, mapValidationMessage } from '@/components/scan/helpers';

export default function EventScanner() {
  const { eventId } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const scanLockRef = useRef(false);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;
      try {
        const response = await EventsInfoAPI.getEvent(eventId);
        setEventTitle(getEventDisplayName(response?.data?.event?.name));
      } catch {
        setEventTitle('Event');
      }
    };
    loadEvent();
  }, [eventId]);

  const resetScan = useCallback(() => {
    setScanned(false);
    setProcessing(false);
    scanLockRef.current = false;
  }, []);

  // The scanner screen stays on the stack after a successful scan. Without this
  // reset, scanned/processing stay true and the camera ignores further codes.
  useFocusEffect(
    useCallback(() => {
      resetScan();
    }, [resetScan])
  );

  const showResultAlert = (title, message, status) => {
    const canContinue = status === 'success' || status === 'warning';

    if (canContinue) {
      Alert.alert(title, message, [
        { text: 'Scan another', onPress: resetScan },
        {
          text: 'Done',
          style: 'cancel',
          onPress: () => router.replace(`/(tabs)/scan/${eventId}`),
        },
      ]);
      return;
    }

    Alert.alert(title, message, [{ text: 'OK', onPress: resetScan }]);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing || scanLockRef.current || !eventId) return;

    scanLockRef.current = true;
    setScanned(true);
    setProcessing(true);

    try {
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch {
        Alert.alert('Invalid QR Code', 'This QR code is not a valid event invitation.', [
          { text: 'OK', onPress: resetScan },
        ]);
        return;
      }

      if (!qrData.email || qrData.code === undefined) {
        Alert.alert('Invalid QR Code', 'Missing visitor information in this QR code.', [
          { text: 'OK', onPress: resetScan },
        ]);
        return;
      }

      const response = await EventsInfoAPI.validateEventInvitation({
        email: qrData.email,
        code: Number(qrData.code),
        id: Number(eventId),
      });

      const message = response?.data?.message || 'Scan processed.';
      const status = mapValidationMessage(message);

      const title =
        status === 'success'
          ? 'Check-in successful'
          : status === 'warning'
            ? 'Already checked in'
            : status === 'error'
              ? 'Check-in failed'
              : 'Scan result';

      showResultAlert(title, message, status);
    } catch (error) {
      console.error('[SCAN] Validation error:', error);
      Alert.alert('Error', 'Failed to validate QR code. Please try again.', [
        { text: 'OK', onPress: resetScan },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-dark items-center justify-center px-6">
        <Skeleton width={200} height={18} borderRadius={12} isDark />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-light dark:bg-dark items-center justify-center px-8">
        <Ionicons name="camera-outline" size={64} color="#ffc801" />
        <Text className="text-lg font-bold text-beta dark:text-light mt-4 text-center">
          Camera permission required
        </Text>
        <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-2">
          Allow camera access to scan visitor QR codes.
        </Text>
        <Pressable onPress={requestPermission} className="mt-6 bg-alpha px-6 py-3 rounded-xl active:opacity-90">
          <Text className="text-beta font-bold">Grant permission</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4 p-2">
          <Text className="text-beta/60 dark:text-light/60">Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark">
      <CameraView
        className="flex-1"
        facing="back"
        active
        onBarcodeScanned={scanned || processing ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <View className="flex-1">
          <View className="flex-row items-center justify-between pt-14 px-4 pb-4">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-beta/60 items-center justify-center active:opacity-80"
            >
              <Ionicons name="arrow-back" size={22} color="#fafafa" />
            </Pressable>
            <Text className="text-light text-base font-bold flex-1 text-center mx-2" numberOfLines={1}>
              {eventTitle}
            </Text>
            <View className="w-10" />
          </View>

          <View className="flex-1 items-center justify-center">
            <View className="w-64 h-64 relative">
              <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-alpha" />
              <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-alpha" />
              <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-alpha" />
              <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-alpha" />
            </View>
          </View>

          <View className="items-center px-8 pb-16">
            {processing ? (
              <View className="items-center gap-3">
                <Skeleton width={28} height={28} borderRadius={14} isDark={false} />
                <Text className="text-light font-semibold">Processing…</Text>
              </View>
            ) : (
              <>
                <Text className="text-light text-base font-semibold text-center">
                  Position the visitor QR code in the frame
                </Text>
                <Text className="text-light/70 text-sm text-center mt-2">
                  Scan invitations sent by lionsgeek.ma
                </Text>
              </>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}
