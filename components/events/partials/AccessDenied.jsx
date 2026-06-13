import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import { getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function AccessDenied() {
  const isDark = useColorScheme() === 'dark';

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark justify-center items-center px-6">
        <Ionicons name="lock-closed" size={64} color={getAccentIconColor(isDark)} />
        <Text className="text-lg font-semibold text-beta dark:text-light mt-4 text-center">
          Access Denied
        </Text>
        <Text className="text-sm text-beta/60 dark:text-light/60 mt-2 text-center">
          You do not have permission to access visitor scanning.
        </Text>
      </View>
    </AppLayout>
  );
}
