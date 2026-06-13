import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EventsInfoAPI from '@/api/eventsInfoSection';
import Skeleton from '@/components/ui/Skeleton';
import ScanResultOverlay from '@/components/events/partials/ScanResultModal';
import { Colors, getAccentFillColor, getAccentIconColor, getOnAccentTextColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getEventDisplayName, mapValidationMessage } from '@/components/events/helpers';

const DUPLICATE_SCAN_MS = 2500;
const CORNER_SIZE = 36;
const BORDER_WIDTH = 4;

function buildScanResult(message, profile) {
  const status = mapValidationMessage(message);
  const visitorName = profile?.name?.trim() || null;
  const normalized = String(message || '').toLowerCase();

  if (status === 'success') {
    return {
      status: 'success',
      title: 'Check-in successful',
      message: visitorName ? `${visitorName} is registered for this event.` : message,
      visitorName,
    };
  }

  if (status === 'warning') {
    return {
      status: 'warning',
      title: 'Already checked in',
      message: visitorName ? `${visitorName} was already scanned for this event.` : message,
      visitorName,
    };
  }

  if (normalized.includes('another event')) {
    return {
      status: 'error',
      title: 'Wrong event',
      message: 'This visitor is registered for a different event.',
      visitorName,
    };
  }

  if (normalized.includes('no such participant')) {
    return {
      status: 'error',
      title: 'Not registered',
      message: 'This visitor is not registered for this event.',
      visitorName,
    };
  }

  return {
    status: 'error',
    title: 'Check-in failed',
    message: message || 'Could not validate this QR code.',
    visitorName,
  };
}

function ScanFrameCorner({ position, borderColor }) {
  const base = {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor,
  };

  const corners = {
    'top-left': { ...base, top: 0, left: 0, borderTopWidth: BORDER_WIDTH, borderLeftWidth: BORDER_WIDTH },
    'top-right': { ...base, top: 0, right: 0, borderTopWidth: BORDER_WIDTH, borderRightWidth: BORDER_WIDTH },
    'bottom-left': { ...base, bottom: 0, left: 0, borderBottomWidth: BORDER_WIDTH, borderLeftWidth: BORDER_WIDTH },
    'bottom-right': { ...base, bottom: 0, right: 0, borderBottomWidth: BORDER_WIDTH, borderRightWidth: BORDER_WIDTH },
  };

  return <View style={corners[position]} />;
}

export default function EventScanner() {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const accentFill = getAccentFillColor(isDark);
  const onAccentText = getOnAccentTextColor(isDark);
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const scanLockRef = useRef(false);
  const lastScanRef = useRef({ data: null, at: 0 });

  useEffect(() => {
    const loadEvent = async () => {
      if (!id) return;
      try {
        const response = await EventsInfoAPI.getEvent(id);
        setEventTitle(getEventDisplayName(response?.data?.event?.name));
      } catch {
        setEventTitle('Event');
      }
    };
    loadEvent();
  }, [id]);

  const resetScanner = useCallback(() => {
    scanLockRef.current = false;
    setProcessing(false);
    lastScanRef.current = { data: null, at: 0 };
  }, []);

  const handleResultDismiss = useCallback(() => {
    setLastResult(null);
    resetScanner();

    if (id) {
      router.replace(`/(tabs)/events/${id}`);
    } else {
      router.back();
    }
  }, [id, resetScanner]);

  useFocusEffect(
    useCallback(() => {
      setLastResult(null);
      resetScanner();
    }, [resetScanner])
  );

  const showFailure = useCallback((title, message) => {
    setLastResult({ title, message, status: 'error', visitorName: null });
    setProcessing(false);
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanLockRef.current || processing || !id) return;

    const now = Date.now();
    if (lastScanRef.current.data === data && now - lastScanRef.current.at < DUPLICATE_SCAN_MS) {
      return;
    }

    scanLockRef.current = true;
    setProcessing(true);
    lastScanRef.current = { data, at: now };

    try {
      let qrData;
      try {
        qrData = JSON.parse(data);
      } catch {
        showFailure('Invalid QR code', 'This QR code is not a valid event invitation.');
        return;
      }

      if (!qrData.email || qrData.code === undefined) {
        showFailure('Invalid QR code', 'Missing visitor information in this QR code.');
        return;
      }

      const response = await EventsInfoAPI.validateEventInvitation({
        email: qrData.email,
        code: Number(qrData.code),
        id: Number(id),
      });

      const message = response?.data?.message || 'Scan processed.';
      const profile = response?.data?.profile;
      setLastResult(buildScanResult(message, profile));
    } catch (error) {
      console.error('[SCAN] Validation error:', error);
      showFailure('Error', 'Failed to validate QR code. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const scanPaused = processing || !!lastResult;

  if (!permission) {
    return (
      <View style={styles.container}>
        <Skeleton width={200} height={18} borderRadius={12} isDark />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionScreen]}>
        <Ionicons name="camera-outline" size={64} color={accentIcon} />
        <Text style={styles.permissionTitle}>Camera permission required</Text>
        <Text style={styles.permissionText}>Allow camera access to scan visitor QR codes.</Text>
        <Pressable onPress={requestPermission} style={[styles.permissionButton, { backgroundColor: accentFill }]}>
          <Text style={[styles.permissionButtonText, { color: onAccentText }]}>Grant permission</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        active
        onBarcodeScanned={scanPaused ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      >
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={Colors.light} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerEyebrow}>SCANNING</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {eventTitle}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.frameSection}>
            <View style={styles.scanFrame}>
              <ScanFrameCorner position="top-left" borderColor={accentFill} />
              <ScanFrameCorner position="top-right" borderColor={accentFill} />
              <ScanFrameCorner position="bottom-left" borderColor={accentFill} />
              <ScanFrameCorner position="bottom-right" borderColor={accentFill} />

              {processing ? (
                <View style={styles.processingWrap}>
                  <Skeleton width={32} height={32} borderRadius={16} isDark={false} />
                  <Text style={styles.processingText}>Validating…</Text>
                </View>
              ) : (
                <Ionicons name="qr-code-outline" size={48} color={accentIcon} />
              )}
            </View>
          </View>

          <View style={styles.instructions}>
            <Text style={styles.instructionsTitle}>Position the visitor QR code in the frame</Text>
            <Text style={styles.instructionsSub}>
              Registered visitors show success. Others show an error, then you return to event details.
            </Text>
          </View>
        </View>
      </CameraView>

      <ScanResultOverlay visible={!!lastResult} result={lastResult} onDismiss={handleResultDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(33, 37, 41, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(250, 250, 250, 0.6)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSpacer: {
    width: 40,
  },
  frameSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  scanFrame: {
    width: 288,
    height: 288,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  processingWrap: {
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    color: Colors.light,
    fontWeight: '600',
    fontSize: 14,
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  instructionsTitle: {
    color: Colors.light,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  instructionsSub: {
    color: 'rgba(250, 250, 250, 0.65)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  permissionScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.light,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.beta,
    marginTop: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: 'rgba(33, 37, 41, 0.6)',
    marginTop: 8,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontWeight: '700',
  },
  backLink: {
    marginTop: 16,
    padding: 8,
  },
  backLinkText: {
    color: 'rgba(33, 37, 41, 0.6)',
  },
});
