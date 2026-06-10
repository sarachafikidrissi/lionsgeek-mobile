import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ParticipantsList({ participants = [] }) {
  if (!participants.length) {
    return (
      <View className="items-center py-8">
        <Ionicons name="people-outline" size={32} color="#ffc801" />
        <Text className="text-sm text-beta/60 dark:text-light/60 mt-2">No registrations yet</Text>
      </View>
    );
  }

  const visited = participants.filter((p) => p.is_visited);
  const pending = participants.filter((p) => !p.is_visited);

  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        <View className="flex-1 bg-good/10 rounded-xl p-3 items-center">
          <Text className="text-2xl font-bold text-good">{visited.length}</Text>
          <Text className="text-[10px] font-semibold text-good uppercase mt-1">Checked in</Text>
        </View>
        <View className="flex-1 bg-beta/5 dark:bg-light/5 rounded-xl p-3 items-center">
          <Text className="text-2xl font-bold text-beta dark:text-light">{pending.length}</Text>
          <Text className="text-[10px] font-semibold text-beta/60 dark:text-light/60 uppercase mt-1">
            Pending
          </Text>
        </View>
      </View>

      {participants.map((participant) => (
        <View
          key={participant.id}
          className="flex-row items-center justify-between py-3 border-b border-beta/10 dark:border-light/10"
        >
          <View className="flex-1 pr-3">
            <Text className="text-sm font-semibold text-beta dark:text-light">{participant.name}</Text>
            <Text className="text-xs text-beta/60 dark:text-light/60 mt-0.5">{participant.email}</Text>
          </View>
          {participant.is_visited ? (
            <View className="flex-row items-center gap-1 bg-good/15 px-2 py-1 rounded-full">
              <Ionicons name="checkmark-circle" size={14} color="#51b04f" />
              <Text className="text-[10px] font-semibold text-good">Visited</Text>
            </View>
          ) : (
            <View className="bg-beta/10 dark:bg-light/10 px-2 py-1 rounded-full">
              <Text className="text-[10px] font-semibold text-beta/50 dark:text-light/50">Pending</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
