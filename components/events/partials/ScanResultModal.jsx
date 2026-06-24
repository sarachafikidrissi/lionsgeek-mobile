import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

const AUTO_DISMISS_MS = 2000;

export default function ScanResultOverlay({ visible, result, onDismiss, dismissHint }) {
  useEffect(() => {
    if (!visible || !result) return undefined;

    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [visible, result, onDismiss]);

  if (!visible || !result) return null;

  const isSuccess = result.status === 'success' || result.status === 'warning';
  const iconName = isSuccess ? 'checkmark-circle' : 'close-circle';
  const iconColor = isSuccess ? Colors.good : Colors.error;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: isSuccess ? `${Colors.good}26` : `${Colors.error}26` },
            ]}
          >
            <Ionicons name={iconName} size={40} color={iconColor} />
          </View>

          <Text style={[styles.title, { color: iconColor }]}>{result.title}</Text>

          {result.visitorName ? (
            <Text style={styles.visitorName}>{result.visitorName}</Text>
          ) : null}

          <Text style={styles.message}>{result.message}</Text>

          <Text style={styles.hint}>
            {dismissHint ?? 'Returning to event details in 2 seconds…'}
          </Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 37, 41, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: Colors.light,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  visitorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.beta,
    textAlign: 'center',
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: 'rgba(33, 37, 41, 0.65)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(33, 37, 41, 0.4)',
    textAlign: 'center',
    marginTop: 16,
  },
});
