import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EventsInfoAPI from '@/api/eventsInfoSection';
import Skeleton from '@/components/ui/Skeleton';
import { getEventDisplayName, mapValidationMessage } from '@/components/scan/helpers';

const DUPLICATE_SCAN_MS = 2500;

export default function EventScanner() {
  const { eventId } = useLocalSearchParams();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [cameraKey, setCameraKey] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const scanLockRef = useRef(false);
  const lastScanRef = useRef({ data: null, at: 0 });

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

  const remountCamera = useCallback(() => {
    setCameraKey((key) => key + 1);
  }, []);

  const unlockScanner = useCallback(() => {
    scanLockRef.current = false;
    setProcessing(false);
    remountCamera();
  }, [remountCamera]);

  const prepareForNextScan = useCallback(() => {
    setLastResult(null);
    unlockScanner();
  }, [unlockScanner]);

  useFocusEffect(
    useCallback(() => {
      setLastResult(null);
      scanLockRef.current = false;
      setProcessing(false);
      lastScanRef.current = { data: null, at: 0 };
      remountCamera();
    }, [remountCamera])
  );

  const showFailure = useCallback(
    (title, message) => {
      setLastResult({ title, message, status: 'error' });
      unlockScanner();
    },
    [unlockScanner]
  );

  const handleBarCodeScanned = async ({ data }) => {
    if (scanLockRef.current || processing || !eventId) return;

    const now = Date.now();
    if (lastScanRef.current.data === data && now - lastScanRef.current.at < DUPLICATE_SCAN_MS) {
      return;
    }

    scanLockRef.current = true;
    setProcessing(true);
    setLastResult(null);
    lastScanRef.current = { data, at: now };

    try {
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch {
        showFailure('Invalid QR Code', 'This QR code is not a valid event invitation.');
        return;
      }

      if (!qrData.email || qrData.code === undefined) {
        showFailure('Invalid QR Code', 'Missing visitor information in this QR code.');
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

      setLastResult({ title, message, status });
    } catch (error) {
      console.error('[SCAN] Validation error:', error);
      showFailure('Error', 'Failed to validate QR code. Please try again.');
    } finally {
      unlockScanner();
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
        key={cameraKey}
        className="flex-1"
        facing="back"
        active
        onBarcodeScanned={processing ? undefined : handleBarCodeScanned}
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

          <View className="items-center px-4 pb-6">
            {processing ? (
              <View className="items-center gap-3">
                <Skeleton width={28} height={28} borderRadius={14} isDark={false} />
                <Text className="text-light font-semibold">Processing…</Text>
              </View>
            ) : lastResult ? (
              <View className="w-full bg-beta/90 rounded-2xl p-4">
                <View className="flex-row items-center gap-2 mb-2">
                  <Ionicons
                    name={
                      lastResult.status === 'success'
                        ? 'checkmark-circle'
                        : lastResult.status === 'warning'
                          ? 'alert-circle'
                          : 'close-circle'
                    }
                    size={22}
                    color={
                      lastResult.status === 'success'
                        ? '#51b04f'
                        : lastResult.status === 'warning'
                          ? '#ffc801'
                          : '#ef4444'
                    }
                  />
                  <Text className="text-light text-base font-bold flex-1">{lastResult.title}</Text>
                </View>
                <Text className="text-light/80 text-sm mb-4">{lastResult.message}</Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={prepareForNextScan}
                    className="flex-1 bg-light/15 py-3 rounded-xl items-center active:opacity-90"
                  >
                    <Text className="text-light font-semibold">Clear</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.replace(`/(tabs)/scan/${eventId}`)}
                    className="flex-1 bg-alpha py-3 rounded-xl items-center active:opacity-90"
                  >
                    <Text className="text-beta font-bold">Done</Text>
                  </Pressable>
                </View>
                <Text className="text-light/60 text-xs text-center mt-3">
                  Point the camera at the next visitor — no need to tap Clear.
                </Text>
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
