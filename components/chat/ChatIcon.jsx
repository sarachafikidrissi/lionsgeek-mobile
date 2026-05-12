import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppContext } from '@/context';
import API from '@/api';
import ConversationsList from './ConversationsList';

// Component dial chat icon - y7al chat w ybdl conversations
export default function ChatIcon() {
    const { user, token } = useAppContext();
    const currentUser = user;
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        fetchUnreadCount();

        const handleOpenChat = (event) => {
            const { userId } = event.detail;
            setIsOpen(false);
            router.push(`/chat/${String(userId)}`);
        };

        // In React Native, use a global event emitter or callback
        if (typeof global !== 'undefined') {
            global.addEventListener?.('open-chat', handleOpenChat);
        }
        
        return () => {
            if (typeof global !== 'undefined') {
                global.removeEventListener?.('open-chat', handleOpenChat);
            }
        };
    }, [currentUser?.id]);

    // Fetch unread count b fetch
    const fetchUnreadCount = async () => {
        try {
            const response = await API.getWithAuth('mobile/chat/unread-count', token);
            if (response && response.data) {
                setUnreadCount(response.data.unread_count || 0);
            }
        } catch (error) {
            console.error('Failed to fetch unread count:', error);
        }
    };

    const handleOpenChange = (open) => {
        setIsOpen(open);
        if (open) {
            fetchUnreadCount();
        }
    };

    return (
        <>
            <Pressable 
                onPress={() => handleOpenChange(true)}
                className="relative h-9 w-9 items-center justify-center"
            >
                <Ionicons name="chatbubbles-outline" size={20} color="#000" />
                {unreadCount > 0 && (
                    <View className="absolute -top-0.5 -right-0.5 h-4 w-4 items-center justify-center rounded-full bg-red-500 border border-white dark:border-gray-900">
                        <Text className="text-[10px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                    </View>
                )}
            </Pressable>
            
            <Modal
                visible={isOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => handleOpenChange(false)}
            >
                <View className="flex-1 bg-white dark:bg-gray-900">
                    <ConversationsList
                        onBeforeNavigateToThread={() => handleOpenChange(false)}
                        onUnreadCountChange={setUnreadCount}
                    />
                </View>
            </Modal>
        </>
    );
}
