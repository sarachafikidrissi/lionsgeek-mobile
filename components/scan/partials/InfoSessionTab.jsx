import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InfoSessionTab() {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="w-20 h-20 rounded-full bg-alpha/15 items-center justify-center mb-4">
        <Ionicons name="school-outline" size={40} color="#ffc801" />
      </View>
      <Text className="text-lg font-bold text-beta dark:text-light text-center">Info Session</Text>
      <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-2 leading-5">
        Participant scanning for info sessions is coming soon. Use the Events tab to scan event visitors.
      </Text>
    </View>
  );
}
