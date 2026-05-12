import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import { useAppContext } from '@/context';

// Component dial popover dyal delete conversation
export default function ConversationDeletePopover({ conversationId, onDeleted }) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { token } = useAppContext();

    const handleDelete = async () => {
        Alert.alert(
            'Delete Conversation',
            'Are you sure you want to delete this conversation? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            const response = await API.remove(`mobile/chat/conversation/${conversationId}`, token);
                            if (response && response.status === 200) {
                                setOpen(false);
                                if (onDeleted) {
                                    onDeleted();
                                }
                            } else {
                                Alert.alert('Error', 'Failed to delete conversation');
                            }
                        } catch (_error) {
                            Alert.alert('Error', 'Failed to delete conversation');
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    if (!open) {
        return (
            <Pressable
                onPress={() => setOpen(true)}
                className="h-8 w-8 items-center justify-center"
            >
                <Ionicons name="ellipsis-vertical" size={16} color="#666" />
            </Pressable>
        );
    }

    return (
        <View className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
            <Pressable
                onPress={handleDelete}
                disabled={deleting}
                className="w-full flex-row items-center px-4 py-3"
            >
                <Ionicons name="trash" size={14} color="#ef4444" />
                <Text className="ml-2 text-red-500 dark:text-red-400">
                    {deleting ? 'Deleting...' : 'Delete Conversation'}
                </Text>
            </Pressable>
            <Pressable
                onPress={() => setOpen(false)}
                className="absolute top-2 right-2"
            >
                <Ionicons name="close" size={16} color="#666" />
            </Pressable>
        </View>
    );
}
