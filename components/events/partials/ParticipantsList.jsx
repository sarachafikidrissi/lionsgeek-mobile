import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

export default function ParticipantsList({ participants = [], emptyMessage, onParticipantPress }) {
  if (!participants.length) {
    return (
      <View className="items-center py-6 mt-2">
        <View className="w-14 h-14 rounded-2xl bg-alpha/15 items-center justify-center mb-3">
          <Ionicons name={emptyMessage ? 'search-outline' : 'people-outline'} size={28} color={Colors.alpha} />
        </View>
        <Text className="text-sm font-semibold text-beta dark:text-light">
          {emptyMessage ? 'No matches' : 'No registrations yet'}
        </Text>
        <Text className="text-xs text-beta/50 dark:text-light/50 text-center mt-1.5 px-2 leading-5">
          {emptyMessage ?? 'Visitors who book on lionsgeek.ma will appear here.'}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3 mt-4">
      <Text className="text-[11px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">
        Visitor list
      </Text>

      <View className="rounded-xl overflow-hidden">
        {participants.map((participant, index) => (
          <Pressable
            key={participant.id}
            onPress={() => onParticipantPress?.(participant)}
            disabled={!onParticipantPress}
            className={`flex-row items-center gap-3 px-1 py-3 active:opacity-80 ${
              index < participants.length - 1 ? 'border-b border-beta/6 dark:border-light/6' : ''
            }`}
          >
            <View className="w-10 h-10 rounded-full bg-alpha/15 items-center justify-center">
              <Text className="text-sm font-bold text-alpha">
                {(participant.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-beta dark:text-light" numberOfLines={1}>
                {participant.name}
              </Text>
              <Text className="text-xs text-beta/55 dark:text-light/55 mt-0.5" numberOfLines={1}>
                {participant.email}
              </Text>
            </View>
            {participant.is_visited ? (
              <View className="flex-row items-center gap-1 bg-good/15 px-2.5 py-1 rounded-full">
                <Ionicons name="qr-code" size={12} color={Colors.good} />
                <Text className="text-[10px] font-semibold text-good">Scanned</Text>
              </View>
            ) : (
              <View className="bg-beta/10 dark:bg-light/10 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-semibold text-beta/50 dark:text-light/50">Not yet</Text>
              </View>
            )}
            {onParticipantPress ? (
              <Ionicons name="chevron-forward" size={16} color={Colors.alpha} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
