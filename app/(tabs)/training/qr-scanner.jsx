import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter, router as routerDirect } from 'expo-router';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import Skeleton from '@/components/ui/Skeleton';
export default function QRScanner() {
  const { id, trainingId } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const routerHook = useRouter();
  const { token, user } = useAppContext();
  const scanLockRef = useRef(false);
  // Safe router navigation function - use hook first, fallback to direct import
  const navigateToTraining = () => {
    try {
      const routerToUse = routerHook || routerDirect;
      if (routerToUse) {
        if (typeof routerToUse.push === 'function') {
          routerToUse.push('/(tabs)/training');
        } else if (typeof routerToUse.replace === 'function') {
          routerToUse.replace('/(tabs)/training');
        } else {
          console.warn('Router navigation methods not available');
        }
      } else {
        console.warn('Router not available');
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [training, setTraining] = useState(null);

  // The training ID from the route params (either id or trainingId)
  const currentTrainingId = id || trainingId;

  useEffect(() => {
    // Fetch training details to verify enrollment (only if training ID is provided)
    const fetchTraining = async () => {
      if (!token || !currentTrainingId) return;
      try {
        const response = await API.getWithAuth(`mobile/trainings/${currentTrainingId}`, token);
        if (response?.data?.training) {
          setTraining(response.data.training);
        }
      } catch (error) {
        console.error('Error fetching training:', error);
      }
    };
    fetchTraining();
  }, [token, currentTrainingId]);

  // Fetch training after QR code is scanned (if not already fetched)
  const fetchTrainingById = async (trainingId) => {
    if (!token || !trainingId) return null;
    try {
      const response = await API.getWithAuth(`mobile/trainings/${trainingId}`, token);
      return response?.data?.training || null;
    } catch (error) {
      console.error('Error fetching training:', error);
      return null;
    }
  };

  // Period determination logic
  const getCurrentPeriod = (currentTime) => {
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    const totalMinutes = hour * 60 + minute;
    
    // Morning: 9:30 (570) - 11:00 (660), can scan until lunch starts (690)
    if (totalMinutes >= 570 && totalMinutes < 690) {
      return { period: 'morning', start: 570, lateThreshold: 600, end: 660, nextPeriodStart: 690 };
    }
    // Lunch: 11:30 (690) - 13:00 (780), can scan until evening starts (840)
    if (totalMinutes >= 690 && totalMinutes < 840) {
      return { period: 'lunch', start: 690, lateThreshold: 720, end: 780, nextPeriodStart: 840 };
    }
    // Evening: 14:00 (840) - 17:00 (1020), can scan until end of day
    if (totalMinutes >= 840 && totalMinutes < 1020) {
      return { period: 'evening', start: 840, lateThreshold: 870, end: 1020, nextPeriodStart: 1440 };
    }
    return null; // Outside all periods
  };

  const determineStatus = (scanTime, period) => {
    if (!period) return 'absent';
    const scanMinutes = scanTime.getHours() * 60 + scanTime.getMinutes();
    // Before period starts
    if (scanMinutes < period.start) return 'absent';
    // At period start (on time)
    if (scanMinutes === period.start) return 'present';
    // After period start but within late threshold (30 minutes)
    if (scanMinutes > period.start && scanMinutes <= period.lateThreshold) return 'late';
    // After late threshold but still within period end
    if (scanMinutes > period.lateThreshold && scanMinutes <= period.end) return 'late';
    // After period ends but before next period starts - mark as late (scanned late but still valid)
    if (scanMinutes > period.end && scanMinutes < period.nextPeriodStart) return 'late';
    // After next period starts
    return 'absent';
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing || scanLockRef.current) return;

    scanLockRef.current = true;
    setScanned(true);
    setProcessing(true);

    try {
      // Parse QR code data
      const qrData = JSON.parse(data);

      if (!qrData.training_id || !qrData.date) {
        Alert.alert('Invalid QR Code', 'The QR code does not contain valid training information.');
        setScanned(false);
        setProcessing(false);
        scanLockRef.current = false;
        return;
      }

      // If we have a currentTrainingId from route params, verify it matches
      if (currentTrainingId && parseInt(qrData.training_id) !== parseInt(currentTrainingId)) {
        Alert.alert('Invalid Training', 'This QR code is for a different training.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Verify date matches today
      const today = new Date().toISOString().split('T')[0];
      if (qrData.date !== today) {
        Alert.alert('Expired QR Code', 'This QR code is not valid for today.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Verify user is enrolled in training
      if (!user || !user.id) {
        Alert.alert('Error', 'User information not available. Please log in again.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      const userId = user.id;

      // Fetch training if not already loaded
      let trainingData = training;
      if (!trainingData || trainingData.id !== parseInt(qrData.training_id)) {
        trainingData = await fetchTrainingById(parseInt(qrData.training_id));
        if (trainingData) {
          setTraining(trainingData);
        }
      }

      if (!trainingData || !trainingData.users || !trainingData.users.some(u => u.id === userId)) {
        Alert.alert('Not Enrolled', 'You are not enrolled in this training.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Get current time and determine period/status
      const now = new Date();
      let period = getCurrentPeriod(now);
      
      // If not in any period window, check if we're in the "late scan" window
      // (after a period ends but before next period starts)
      if (!period) {
        const scanMinutes = now.getHours() * 60 + now.getMinutes();
        
        // Check if we're between morning end (660) and lunch start (690)
        if (scanMinutes >= 660 && scanMinutes < 690) {
          period = { period: 'morning', start: 570, lateThreshold: 600, end: 660, nextPeriodStart: 690 };
        }
        // Check if we're between lunch end (780) and evening start (840)
        else if (scanMinutes >= 780 && scanMinutes < 840) {
          period = { period: 'lunch', start: 690, lateThreshold: 720, end: 780, nextPeriodStart: 840 };
        }
        // Check if we're after evening end (1020) but still same day
        else if (scanMinutes >= 1020 && scanMinutes < 1440) {
          period = { period: 'evening', start: 840, lateThreshold: 870, end: 1020, nextPeriodStart: 1440 };
        }
      }
      
      const status = determineStatus(now, period);

      if (!period) {
        Alert.alert(
          'Outside Training Hours',
          'You are scanning outside of training periods. Attendance cannot be marked.',
          [{
            text: 'OK', onPress: () => {
              setScanned(false);
              setProcessing(false);
              scanLockRef.current = false;
            }
          }]
        );
        return;
      }

      // Create or get attendance record
      const attendanceDay = today;
      const trainingIdFromQR = parseInt(qrData.training_id);
      let attendanceResponse;
      try {
        attendanceResponse = await API.postWithAuth('mobile/attendances', {
          formation_id: trainingIdFromQR,
          attendance_day: attendanceDay,
        }, token);
      } catch (error) {
        console.error('Error creating attendance:', error);
        Alert.alert('Error', 'Failed to create attendance record.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      if (!attendanceResponse?.data?.attendance_id) {
        Alert.alert('Error', 'Failed to get attendance record.');
        setScanned(false);
        setProcessing(false);
        return;
      }

      // Get existing attendance for this user if it exists
      const existingAttendance = attendanceResponse.data.lists?.find(
        (item) => item.user_id === userId
      );

      // Helper function to check if a period was already scanned via QR code
      // A period is considered "scanned" if it exists in existingAttendance
      // The key insight: if existingAttendance exists, it means the user has attendance data
      // If a period has a value in that data, it was set (scanned or manually)
      // If existingAttendance doesn't exist, nothing was scanned yet
      const wasPeriodScanned = (periodName) => {
        // If no existing attendance record exists, nothing was scanned
        if (!existingAttendance) return false;
        
        // Check if the period has a value set in existingAttendance
        // If it exists in the record, it was set (either scanned or manually)
        const periodStatus = existingAttendance[periodName];
        return periodStatus !== undefined && 
               periodStatus !== null && 
               periodStatus !== '';
      };

      // Determine status for each period based on which period is being scanned
      let morningStatus, lunchStatus, eveningStatus;

      if (period.period === 'morning') {
        // Scanning morning - no earlier periods to mark absent
        morningStatus = status; // Scanned period gets determined status
        lunchStatus = wasPeriodScanned('lunch') ? existingAttendance.lunch : 'present';
        eveningStatus = wasPeriodScanned('evening') ? existingAttendance.evening : 'present';
      } else if (period.period === 'lunch') {
        // Scanning lunch - mark morning as absent if not scanned
        morningStatus = wasPeriodScanned('morning') ? existingAttendance.morning : 'absent';
        lunchStatus = status; // Scanned period gets determined status
        eveningStatus = wasPeriodScanned('evening') ? existingAttendance.evening : 'present';
      } else if (period.period === 'evening') {
        // Scanning evening - mark morning and lunch as absent if not scanned
        morningStatus = wasPeriodScanned('morning') ? existingAttendance.morning : 'absent';
        lunchStatus = wasPeriodScanned('lunch') ? existingAttendance.lunch : 'absent';
        eveningStatus = status; // Scanned period gets determined status
      }

      // Create attendance payload with user ID and determined status
      // Mark earlier unscanned periods as absent, preserve existing attendance
      const attendancePayload = [{
        attendance_id: attendanceResponse.data.attendance_id,
        user_id: userId,
        attendance_day: attendanceDay,
        morning: morningStatus,
        lunch: lunchStatus,
        evening: eveningStatus,
        note: existingAttendance?.note
          ? `${existingAttendance.note} | QR Code scan at ${format(now, 'HH:mm')}`
          : `QR Code scan at ${format(now, 'HH:mm')}`,
      }];

      // Save attendance - backend will match user_id from token
      await API.postWithAuth('mobile/attendance/save', {
        attendance: attendancePayload,
      }, token);

      const statusMessage = status === 'present' ? 'Present' : status === 'late' ? 'Late' : 'Absent';
      const periodName = period.period.charAt(0).toUpperCase() + period.period.slice(1);

      Alert.alert(
        'Attendance Marked',
        `You have been marked as ${statusMessage} for the ${periodName} period.`,
        [
          {
            text: 'OK',
            onPress: navigateToTraining
          }
        ]
      );
    } catch (error) {
      console.error('QR Scan Error:', error);
      Alert.alert('Error', 'Failed to process QR code. Please try again.');
      setScanned(false);
      setProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={{ paddingHorizontal: 24, paddingTop: 120, alignItems: 'center' }}>
          <Skeleton width={240} height={18} borderRadius={12} isDark={isDark} />
          <View style={{ height: 14 }} />
          <Skeleton width={180} height={14} borderRadius={12} isDark={isDark} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer(isDark)}>
          <Ionicons name="camera-outline" size={64} color={Colors.alpha} />
          <Text style={styles.permissionTitle(isDark)}>Camera Permission Required</Text>
          <Text style={styles.permissionText(isDark)}>
            We need access to your camera to scan QR codes for attendance.
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        active={true}
        onBarcodeScanned={scanned || processing ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.backButton(isDark)}
              onPress={navigateToTraining}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.light} />
            </Pressable>
            <Text style={styles.headerTitle}>Scan QR Code</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Scanning Frame */}
          <View style={styles.scanFrame}>
            <View style={styles.scanFrameCorner('top-left')} />
            <View style={styles.scanFrameCorner('top-right')} />
            <View style={styles.scanFrameCorner('bottom-left')} />
            <View style={styles.scanFrameCorner('bottom-right')} />
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer(isDark)}>
            {processing ? (
              <View style={styles.processingContainer}>
                <Skeleton width={28} height={28} borderRadius={14} isDark={false} />
                <Text style={styles.instructionsText(isDark)}>Processing…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.instructionsText(isDark)}>
                  Position the QR code within the frame
                </Text>
                <Text style={styles.instructionsSubtext(isDark)}>
                  Make sure the code is clearly visible
                </Text>
              </>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: (isDark) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  scanFrame: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginTop: 100,
    position: 'relative',
  },
  scanFrameCorner: (position) => {
    const cornerSize = 30;
    const borderWidth = 4;
    let cornerStyle = {
      position: 'absolute',
      width: cornerSize,
      height: cornerSize,
      borderColor: Colors.alpha,
    };

    if (position === 'top-left') {
      cornerStyle = {
        ...cornerStyle,
        top: 0,
        left: 0,
        borderTopWidth: borderWidth,
        borderLeftWidth: borderWidth,
      };
    } else if (position === 'top-right') {
      cornerStyle = {
        ...cornerStyle,
        top: 0,
        right: 0,
        borderTopWidth: borderWidth,
        borderRightWidth: borderWidth,
      };
    } else if (position === 'bottom-left') {
      cornerStyle = {
        ...cornerStyle,
        bottom: 0,
        left: 0,
        borderBottomWidth: borderWidth,
        borderLeftWidth: borderWidth,
      };
    } else if (position === 'bottom-right') {
      cornerStyle = {
        ...cornerStyle,
        bottom: 0,
        right: 0,
        borderBottomWidth: borderWidth,
        borderRightWidth: borderWidth,
      };
    }

    return cornerStyle;
  },
  instructionsContainer: (isDark) => ({
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  }),
  instructionsText: (isDark) => ({
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
  }),
  instructionsSubtext: (isDark) => ({
    fontSize: 14,
    color: Colors.light + 'CC',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  }),
  processingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  permissionContainer: (isDark) => ({
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: isDark ? Colors.dark : Colors.light,
  }),
  permissionTitle: (isDark) => ({
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? Colors.light : Colors.beta,
    marginTop: 24,
    marginBottom: 12,
  }),
  permissionText: (isDark) => ({
    fontSize: 16,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    textAlign: 'center',
    marginBottom: 32,
  }),
  permissionButton: {
    backgroundColor: Colors.alpha,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: Colors.light,
    fontSize: 16,
    fontWeight: '700',
  },
});
