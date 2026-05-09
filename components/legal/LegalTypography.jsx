import { Text, View } from 'react-native';

/** Small caption (last updated, version notes). */
export function LegalMeta({ children }) {
  return (
    <Text className="mb-6 text-xs font-medium leading-5 text-neutral-500 dark:text-white/45">
      {children}
    </Text>
  );
}

/** Section heading inside legal docs. */
export function LegalH2({ children }) {
  return (
    <Text className="mb-2 mt-6 text-base font-bold text-beta dark:text-white">
      {children}
    </Text>
  );
}

/** Body paragraph. */
export function LegalP({ children }) {
  return (
    <Text className="mb-4 text-[14px] leading-[22px] text-neutral-700 dark:text-white/80">{children}</Text>
  );
}

/** Bullet line (single row). */
export function LegalBullet({ children }) {
  return (
    <View className="mb-2 flex-row pl-1">
      <Text className="mr-2 text-[14px] text-neutral-700 dark:text-white/75">•</Text>
      <Text className="flex-1 text-[14px] leading-[22px] text-neutral-700 dark:text-white/80">{children}</Text>
    </View>
  );
}
