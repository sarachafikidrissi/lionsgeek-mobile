import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import { Colors } from '@/constants/Colors';

/**
 * Premium “hub” layout for More destinations — filled content + optional primary CTA.
 */
export default function MoreHubScreen({
  icon = 'sparkles',
  iconColor = Colors.alpha,
  title,
  eyebrow,
  description,
  bullets = [],
  primaryAction,
  secondaryAction,
}) {
  return (
    <AppLayout showNavbar={false} className="flex-1 bg-light dark:bg-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-16 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {eyebrow ? (
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-neutral-500 dark:text-alpha/80">
            {eyebrow}
          </Text>
        ) : null}
        <View className="mb-5 items-center rounded-3xl border border-black/[0.06] bg-alpha/8 py-8 dark:border-white/10 dark:bg-alpha/10">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-alpha/20">
            <Ionicons name={icon} size={34} color={iconColor} />
          </View>
          <Text className="px-4 text-center text-2xl font-extrabold text-beta dark:text-white">{title}</Text>
          {description ? (
            <Text className="mt-3 px-4 text-center text-[15px] leading-[23px] text-neutral-600 dark:text-white/75">
              {description}
            </Text>
          ) : null}
        </View>

        {bullets.length > 0 ? (
          <View className="mb-6 rounded-2xl border border-black/[0.06] bg-white px-4 py-4 dark:border-white/10 dark:bg-dark_gray">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-white/45">
              Highlights
            </Text>
            {bullets.map((line, i) => (
              <View key={i} className="mb-3 flex-row">
                <Ionicons name="checkmark-circle" size={18} color={Colors.alpha} style={{ marginTop: 2 }} />
                <Text className="ml-2 flex-1 text-[14px] leading-[21px] text-neutral-700 dark:text-white/85">
                  {line}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {primaryAction ? (
          <TouchableOpacity
            onPress={primaryAction.onPress}
            activeOpacity={0.85}
            className="mb-3 rounded-2xl bg-alpha py-4"
          >
            <Text className="text-center text-[15px] font-bold text-beta">{primaryAction.label}</Text>
          </TouchableOpacity>
        ) : null}

        {secondaryAction ? (
          <TouchableOpacity
            onPress={secondaryAction.onPress}
            activeOpacity={0.75}
            className="rounded-2xl border border-alpha/50 py-4 dark:border-alpha/40"
          >
            <Text className="text-center text-[15px] font-semibold text-alpha">{secondaryAction.label}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </AppLayout>
  );
}
