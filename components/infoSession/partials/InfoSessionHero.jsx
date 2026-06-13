import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function InfoSessionHero({ formation, height = 128, borderRadius = 0, className = '' }) {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const isCoding = formation === 'Coding';

  return (
    <View
      className={`w-full bg-beta/15 dark:bg-alpha/15 items-center justify-center ${className}`}
      style={{ height, borderRadius }}
    >
      <Ionicons
        name={isCoding ? 'code-slash' : 'color-palette-outline'}
        size={height >= 140 ? 40 : 32}
        color={accentIcon}
      />
      <Text className="text-xs font-bold text-beta/50 dark:text-light/50 mt-2 uppercase tracking-wide">
        {formation || 'Info Session'}
      </Text>
    </View>
  );
}
