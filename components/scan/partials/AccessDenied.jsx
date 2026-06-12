import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';

export default function AccessDenied() {
  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark justify-center items-center px-6">
        <Ionicons name="lock-closed" size={64} color="#ffc801" />
        <Text className="text-lg font-semibold text-beta dark:text-light mt-4 text-center">
          Access Denied
        </Text>
        <Text className="text-sm text-beta/60 dark:text-light/60 mt-2 text-center">
          Only admins can access visitor scanning.
        </Text>
      </View>
    </AppLayout>
  );
}
