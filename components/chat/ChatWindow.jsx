import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAppContext } from '@/context';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

function tryParsePostShare(body) {
    if (!body) return null;
    if (typeof body === 'object') {
        return body?.type === 'post_share' && body?.post_id ? body : null;
    }
    if (typeof body !== 'string') return null;
    const trimmed = body.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.type !== 'post_share' || !parsed?.post_id) return null;
        return parsed;
    } catch {
        return null;
    }
}

export default function ChatWindow({ conversation, onBack }) {
    const { user, token } = useAppContext();
    const currentUser = user;
    const [messages, setMessages] = useState(conversation.messages || []);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchMessages();
        // Poll for new messages every 5 seconds
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [conversation.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const response = await API.getWithAuth(`mobile/chat/conversation/${conversation.id}/messages`, token);
            if (response && response.data) {
                setMessages(response.data.messages || []);
                
                // Mark as read
                await API.postWithAuth(`mobile/chat/conversation/${conversation.id}/read`, {}, token);
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        // In React Native, we'll use scrollToEnd on ScrollView
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollToEnd({ animated: true });
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        const messageBody = newMessage.trim();
        setNewMessage('');
        setSending(true);

        try {
            const response = await API.postWithAuth(
                `mobile/chat/conversation/${conversation.id}/send`,
                { body: messageBody },
                token
            );

            if (response && response.data) {
                setMessages(prev => [...prev, response.data.message]);
                setTimeout(() => fetchMessages(), 500);
            } else {
                setNewMessage(messageBody);
                alert('Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            setNewMessage(messageBody);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const isCurrentUserMessage = (senderId) => {
        return String(senderId) === String(currentUser.id);
    };

    return (
        <View className="flex-col h-full">
            {/* Header */}
            <View className="flex-row items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
                <Pressable onPress={onBack} className="h-8 w-8 items-center justify-center">
                    <Ionicons name="arrow-back" size={20} color="#000" />
                </Pressable>
                {conversation.other_user?.image ? (
                    <Image
                        source={{ uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}` }}
                        className="h-10 w-10 rounded-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center">
                        <Ionicons name="person" size={20} color="#666" />
                    </View>
                )}
                <View className="flex-1">
                    <Text className="font-semibold text-black dark:text-white" numberOfLines={1}>
                        {conversation.other_user?.name || 'User'}
                    </Text>
                    {userHasAdminRole(currentUser) && conversation.other_user?.email ? (
                        <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                            {conversation.other_user.email}
                        </Text>
                    ) : null}
                </View>
            </View>

            {/* Messages */}
            <ScrollView 
                ref={messagesEndRef}
                className="flex-1 p-4"
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {loading && messages.length === 0 ? (
                    <View className="items-center justify-center h-full">
                        <View style={{ width: '100%', paddingHorizontal: 16 }}>
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <View
                                    key={idx}
                                    style={{
                                        marginBottom: 10,
                                        alignSelf: idx % 2 === 0 ? 'flex-start' : 'flex-end',
                                        width: idx % 2 === 0 ? '76%' : '64%',
                                    }}
                                >
                                    <Skeleton width="100%" height={34} borderRadius={12} isDark={false} />
                                </View>
                            ))}
                        </View>
                    </View>
                ) : messages.length === 0 ? (
                    <View className="items-center justify-center h-full">
                        <Text className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</Text>
                    </View>
                ) : (
                    <View className="gap-4">
                        {messages.map((message, index) => {
                            const isCurrentUser = isCurrentUserMessage(message.sender_id);
                            const showDate = index === 0 || 
                                new Date(message.created_at).toDateString() !== 
                                new Date(messages[index - 1].created_at).toDateString();

                            return (
                                <View key={message.id}>
                                    {showDate && (
                                        <View className="items-center my-4">
                                            <Text className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
                                                {format(new Date(message.created_at), 'MMMM d, yyyy')}
                                            </Text>
                                        </View>
                                    )}
                                    <View className={`flex-row ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                                        <View className={`max-w-[70%] rounded-lg px-4 py-2 ${isCurrentUser 
                                            ? 'bg-yellow-500' 
                                            : 'bg-gray-200 dark:bg-gray-800'
                                        }`}>
                                            {tryParsePostShare(message.body) ? (
                                                <Text className={`text-sm font-semibold ${isCurrentUser ? 'text-black' : 'text-black dark:text-white'}`}>
                                                    📌 Sent a post
                                                </Text>
                                            ) : message.body ? (
                                                <Text className={`text-sm ${isCurrentUser ? 'text-black' : 'text-black dark:text-white'}`}>
                                                    {typeof message.body === 'string' ? message.body : 'Sent a message'}
                                                </Text>
                                            ) : null}
                                            <Text className={`text-xs mt-1 ${isCurrentUser ? 'text-black/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {format(new Date(message.created_at), 'h:mm a')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Message Input */}
            <View className="p-4 border-t border-gray-200 dark:border-gray-800 flex-row gap-2">
                <TextInput
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Type a message..."
                    placeholderTextColor="#999"
                    className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 text-black dark:text-white"
                    editable={!sending}
                />
                <Pressable 
                    onPress={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className={`h-11 px-4 items-center justify-center rounded-lg ${sending || !newMessage.trim() ? 'bg-gray-300 dark:bg-gray-700 opacity-50' : 'bg-yellow-500'}`}
                >
                    {sending ? (
                        <Skeleton width={16} height={16} borderRadius={8} isDark={false} />
                    ) : (
                        <Ionicons name="send" size={16} color="#000" />
                    )}
                </Pressable>
            </View>
        </View>
    );
}
