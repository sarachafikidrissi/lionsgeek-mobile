import React from 'react';
import { View, Text, Pressable, Image, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import API from '@/api';

export default function ChatHeader({ conversation, onBack }) {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const insets = useSafeAreaInsets();
    const isDark = colorScheme === 'dark';
    const fg = isDark ? '#fff' : '#000';

    const lastOnline = conversation.other_user?.last_online
        ? new Date(conversation.other_user.last_online)
        : null;
    const rawPhone = conversation.other_user?.phone ?? conversation.other_user?.mobile ?? conversation.other_user?.tel;
    const phoneDigits = rawPhone ? String(rawPhone).replace(/[^\d+]/g, '') : '';

    const handleCall = () => {
        if (!phoneDigits || phoneDigits.length < 6) {
            Alert.alert('Call', 'No phone number is available for this user.');
            return;
        }
        const uri = phoneDigits.startsWith('+') ? `tel:${phoneDigits}` : `tel:${phoneDigits}`;
        Linking.openURL(uri).catch(() => Alert.alert('Call', 'Unable to start a phone call from this device.'));
    };

    let statusLine = null;
    let isOnline = false;
    if (lastOnline) {
        const diffMinutes = Math.floor((Date.now() - lastOnline) / (1000 * 60));
        isOnline = diffMinutes <= 5;
        statusLine = isOnline
            ? 'Active now'
            : `Last seen ${diffMinutes < 60 ? `${diffMinutes}m ago` : `${Math.floor(diffMinutes / 60)}h ago`}`;
    }

    return (
        <View
            className="border-b border-black/[0.06] dark:border-white/[0.08] bg-light dark:bg-dark overflow-hidden"
            style={{ paddingTop: Math.max(insets.top, 8) }}
        >
            <View className="absolute -right-8 -top-10 w-36 h-36 rotate-12 bg-alpha/12 rounded-3xl" />
            <View className="flex-row items-center px-3 py-3 gap-2">
                {onBack && (
                    <Pressable
                        onPress={onBack}
                        className="w-10 h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] items-center justify-center active:opacity-70"
                    >
                        <Ionicons name="chevron-back" size={22} color={fg} />
                    </Pressable>
                )}
                <View className="flex-1 flex-row items-center min-w-0 gap-3">
                    <Pressable
                        onPress={() => router.push(`/students/${conversation.other_user.id}`)}
                        className="relative"
                    >
                        {conversation.other_user?.image ? (
                            <Image
                                source={{ uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}` }}
                                className="w-12 h-12 rounded-2xl"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-12 h-12 rounded-2xl bg-neutral-200 dark:bg-zinc-800 items-center justify-center">
                                <Text className="text-lg font-bold text-black/30 dark:text-white/30">
                                    {(conversation.other_user?.name || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <View
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-light dark:border-dark ${
                                isOnline ? 'bg-alpha' : 'bg-neutral-400 dark:bg-zinc-600'
                            }`}
                        />
                    </Pressable>
                    <Pressable
                        onPress={() => router.push(`/students/${conversation.other_user.id}`)}
                        className="flex-1 min-w-0"
                    >
                        <Text className="text-base font-extrabold text-black dark:text-white tracking-tight" numberOfLines={1}>
                            {conversation.other_user?.name || 'User'}
                        </Text>
                        <Text className="text-[11px] mt-0.5 uppercase tracking-[0.14em] text-black/50 dark:text-white/50" numberOfLines={1}>
                            {statusLine || 'Offline'}
                        </Text>
                    </Pressable>
                </View>
                <Pressable
                    onPress={handleCall}
                    accessibilityLabel="Voice call"
                    className="w-10 h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] items-center justify-center active:opacity-70"
                >
                    <Ionicons name="call-outline" size={20} color={fg} />
                </Pressable>
            </View>
        </View>
    );
}
