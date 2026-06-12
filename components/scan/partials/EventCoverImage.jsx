import { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function EventCoverImage({ uri, height = 128, borderRadius = 0, className = '' }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View
        className={`w-full bg-alpha/15 items-center justify-center ${className}`}
        style={{ height, borderRadius }}
      >
        <Ionicons name="calendar" size={height >= 140 ? 40 : 32} color="#ffc801" />
      </View>
    );
  }

  return (
    <View className={`w-full ${className}`} style={{ height, borderRadius, overflow: 'hidden' }}>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded ? (
        <View style={[StyleSheet.absoluteFill, styles.skeletonLayer]}>
          <Skeleton width="100%" height={height} borderRadius={borderRadius} isDark={isDark} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonLayer: {
    zIndex: 1,
  },
});
