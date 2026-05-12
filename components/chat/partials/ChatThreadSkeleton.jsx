import React from 'react';
import { View, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import Skeleton from '@/components/ui/Skeleton';

/**
 * Full-screen placeholder while a 1:1 thread payload loads — matches ChatBox chrome (header / rail / composer).
 */
export default function ChatThreadSkeleton({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const fg = isDark ? '#fff' : '#000';

  const bubbleMax = Math.min(320, Math.max(200, screenW * 0.72));
  const rows = [
    { side: 'left', ratio: 0.85 },
    { side: 'right', ratio: 0.62 },
    { side: 'left', ratio: 0.78 },
    { side: 'right', ratio: 0.55 },
    { side: 'left', ratio: 0.7 },
    { side: 'right', ratio: 0.68 },
  ].map((r) => ({ ...r, w: Math.round(bubbleMax * r.ratio) }));

  return (
    <View className="flex-1 bg-light dark:bg-dark">
      <View
        className="border-b border-black/[0.06] dark:border-white/[0.08] bg-light dark:bg-dark overflow-hidden"
        style={{ paddingTop: Math.max(insets.top, 8) }}
      >
        <View className="absolute -right-8 -top-10 w-36 h-36 rotate-12 bg-alpha/12 rounded-3xl" />
        <View className="flex-row items-center px-3 py-3 gap-2">
          {onBack ? (
            <Pressable
              onPress={onBack}
              className="w-10 h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] items-center justify-center active:opacity-70"
            >
              <Ionicons name="chevron-back" size={22} color={fg} />
            </Pressable>
          ) : (
            <View className="w-10 h-10" />
          )}
          <View className="flex-1 flex-row items-center min-w-0 gap-3">
            <Skeleton width={48} height={48} borderRadius={16} isDark={isDark} />
            <View className="flex-1 min-w-0 gap-2">
              <Skeleton width="62%" height={16} borderRadius={8} isDark={isDark} />
              <Skeleton width="40%" height={11} borderRadius={6} isDark={isDark} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-[#ebe8e2] dark:bg-[#101010]"
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-5 px-1 py-2 w-full max-w-3xl mx-auto">
          {rows.map((row, i) => {
            const isRight = row.side === 'right';
            return (
              <View key={i} className={`flex-row mb-1 ${isRight ? 'justify-end' : 'justify-start'}`}>
                {!isRight ? (
                  <Skeleton width={28} height={28} borderRadius={8} isDark={isDark} style={{ marginRight: 8, alignSelf: 'flex-end', marginBottom: 4 }} />
                ) : null}
                <View className="max-w-[78%] gap-2">
                  <Skeleton width={row.w} height={52} borderRadius={18} isDark={isDark} />
                  <Skeleton width={48} height={10} borderRadius={4} isDark={isDark} style={{ alignSelf: isRight ? 'flex-end' : 'flex-start' }} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="border-t border-black/[0.06] dark:border-white/[0.08] bg-light dark:bg-dark px-3 pt-2"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Skeleton width="100%" height={48} borderRadius={24} isDark={isDark} />
      </View>
    </View>
  );
}
