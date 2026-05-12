import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAppContext } from '@/context';
import API from '@/api';
import VoiceMessage from './VoiceMessage';
import Skeleton from '@/components/ui/Skeleton';

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

export default function FloatingChatWindow({ conversation, onClose, onMinimize, onExpand, isMinimized, isExpanded }) {
    const { user, token } = useAppContext();
    const currentUser = user;
    const [messages, setMessages] = useState(conversation.messages || []);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!isMinimized && !isExpanded) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 5000);
            return () => clearInterval(interval);
        } else if (isExpanded) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [conversation.id, isMinimized, isExpanded]);

    useEffect(() => {
        if (!isMinimized) {
            scrollToBottom();
        }
    }, [messages, isMinimized]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const response = await API.getWithAuth(`mobile/chat/conversation/${conversation.id}/messages`, token);
            if (response && response.data) {
                setMessages(response.data.messages || []);
                
                await API.postWithAuth(`mobile/chat/conversation/${conversation.id}/read`, {}, token);
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollToEnd({ animated: true });
        }
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !attachment) || sending) return;

        setSending(true);
        const messageBody = newMessage.trim();
        
        // Reset form
        setNewMessage('');
        setAttachment(null);

        try {
            const formData = new FormData();
            formData.append('body', messageBody);
            
            if (attachment) {
                formData.append('attachment', {
                    uri: attachment.uri,
                    type: attachment.type,
                    name: attachment.name,
                });
                const attachmentType = attachment.type.startsWith('image/') ? 'image' : 'file';
                formData.append('attachment_type', attachmentType);
            }

            const response = await API.postWithAuth(
                `mobile/chat/conversation/${conversation.id}/send`,
                formData,
                token
            );

            if (response && response.data) {
                setMessages(prev => [...prev, response.data.message]);
                setTimeout(() => fetchMessages(), 500);
            } else {
                alert('Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const isCurrentUserMessage = (senderId) => {
        return String(senderId) === String(currentUser.id);
    };

    const renderMessage = (message) => {
        const isCurrentUser = isCurrentUserMessage(message.sender_id);
        const postShare = tryParsePostShare(message.body);
        const imageUrl = message.attachment_path?.startsWith('/storage/') || message.attachment_path?.startsWith('http')
            ? message.attachment_path
            : `${API.APP_URL}/storage/${message.attachment_path}`;
        
        return (
            <View key={message.id} className={`flex-row mb-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                <View className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isCurrentUser 
                    ? 'bg-yellow-500' 
                    : 'bg-gray-200 dark:bg-gray-800'
                }`}>
                    {postShare ? (
                        <Text className="text-black dark:text-white font-semibold">📌 Sent a post</Text>
                    ) : message.body ? (
                        <Text className="text-black dark:text-white">
                            {typeof message.body === 'string' ? message.body : 'Sent a message'}
                        </Text>
                    ) : null}
                    
                    {message.attachment_type === 'image' && message.attachment_path && (
                        <Image 
                            source={{ uri: imageUrl }}
                            className="mt-2 rounded max-w-full max-h-64"
                            resizeMode="contain"
                        />
                    )}
                    
                    {message.attachment_type === 'file' && message.attachment_path && (
                        <Pressable
                            onPress={() => Linking.openURL(imageUrl)}
                            className={`mt-2 flex-row items-center gap-2 p-2 rounded border ${isCurrentUser ? 'bg-white/10 border-white/20' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                        >
                            <Ionicons name="document" size={16} color={isCurrentUser ? '#000' : '#666'} />
                            <Text className="text-xs text-black dark:text-white" numberOfLines={1}>
                                {message.attachment_name || 'Attachment'}
                            </Text>
                        </Pressable>
                    )}
                    
                    {message.attachment_type === 'audio' && message.attachment_path && (
                        <View className={`mt-2 flex-row items-center gap-2 p-2 rounded ${isCurrentUser ? 'bg-white/10' : 'bg-white dark:bg-gray-700'}`}>
                            <VoiceMessage
                                audioUrl={imageUrl}
                                duration={message.audio_duration}
                                isCurrentUser={isCurrentUser}
                            />
                        </View>
                    )}
                    
                    <Text className={`text-xs mt-1 ${isCurrentUser ? 'text-black/70' : 'text-gray-500 dark:text-gray-400'}`}>
                        {format(new Date(message.created_at), 'h:mm a')}
                    </Text>
                </View>
            </View>
        );
    };

    if (isMinimized) {
        const lastMessage = messages[messages.length - 1];
        const unreadCount = messages.filter(m => !m.is_read && !isCurrentUserMessage(m.sender_id)).length;
        
        return (
            <View className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-t-lg shadow-lg overflow-hidden">
                <Pressable 
                    onPress={onMinimize}
                    className="flex-row items-center gap-2 p-3"
                >
                    {conversation.other_user?.image ? (
                        <Image
                            source={{ uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}` }}
                            className="h-8 w-8 rounded-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center">
                            <Ionicons name="person" size={16} color="#666" />
                        </View>
                    )}
                    <View className="flex-1">
                        <Text className="text-sm font-medium text-black dark:text-white" numberOfLines={1}>
                            {conversation.other_user?.name || 'User'}
                        </Text>
                        {lastMessage && (
                            <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                                {lastMessage.attachment_type === 'audio' 
                                    ? '🎤 Voice message' 
                                    : lastMessage.attachment_type === 'image'
                                    ? '📷 Image'
                                    : lastMessage.attachment_type === 'file'
                                    ? '📎 File'
                                    : (tryParsePostShare(lastMessage.body) ? '📌 Post' : (typeof lastMessage.body === 'string' ? lastMessage.body : 'Message'))}
                            </Text>
                        )}
                    </View>
                    {unreadCount > 0 && (
                        <View className="h-5 w-5 bg-red-500 rounded-full items-center justify-center">
                            <Text className="text-xs font-bold text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </Pressable>
            </View>
        );
    }

    const windowSize = isExpanded 
        ? { width: '100%', height: '100%' }
        : { width: 320, height: 500 };

    return (
        <View 
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl flex-col"
            style={windowSize}
        >
            {/* Header */}
            <View className="flex-row items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-800">
                {conversation.other_user?.image ? (
                    <Image
                        source={{ uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}` }}
                        className="h-8 w-8 rounded-full"
                        resizeMode="cover"
                    />
                ) : (
                    <View className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center">
                        <Ionicons name="person" size={16} color="#666" />
                    </View>
                )}
                <View className="flex-1">
                    <Text className="text-sm font-semibold text-black dark:text-white" numberOfLines={1}>
                        {conversation.other_user?.name || 'User'}
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>Online</Text>
                </View>
                {onExpand && (
                    <Pressable
                        onPress={onExpand}
                        className="h-7 w-7 items-center justify-center"
                    >
                        <Ionicons name={isExpanded ? "contract" : "expand"} size={14} color="#666" />
                    </Pressable>
                )}
                <Pressable
                    onPress={onMinimize}
                    className="h-7 w-7 items-center justify-center"
                >
                    <Ionicons name="remove" size={14} color="#666" />
                </Pressable>
                <Pressable
                    onPress={onClose}
                    className="h-7 w-7 items-center justify-center"
                >
                    <Ionicons name="close" size={14} color="#666" />
                </Pressable>
            </View>

            {/* Messages */}
            <ScrollView 
                ref={messagesEndRef}
                className={`flex-1 ${isExpanded ? 'p-6' : 'p-3'}`}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {loading && messages.length === 0 ? (
                    <View className="items-center justify-center h-full">
                        <View style={{ width: '100%', paddingHorizontal: 12 }}>
                            {Array.from({ length: 7 }).map((_, idx) => (
                                <View
                                    key={idx}
                                    style={{
                                        marginBottom: 8,
                                        alignSelf: idx % 2 === 0 ? 'flex-start' : 'flex-end',
                                        width: idx % 2 === 0 ? '78%' : '60%',
                                    }}
                                >
                                    <Skeleton width="100%" height={32} borderRadius={12} isDark={false} />
                                </View>
                            ))}
                        </View>
                    </View>
                ) : messages.length === 0 ? (
                    <View className="items-center justify-center h-full">
                        <Text className="text-gray-500 dark:text-gray-400 text-sm">No messages yet. Start the conversation!</Text>
                    </View>
                ) : (
                    <View className={`gap-1 ${isExpanded ? 'max-w-4xl mx-auto' : ''}`}>
                        {messages.map(renderMessage)}
                    </View>
                )}
            </ScrollView>

            {/* Attachment Preview */}
            {attachment && (
                <View className="p-3 border-t border-gray-200 dark:border-gray-800 flex-row items-center gap-2 bg-gray-100 dark:bg-gray-800">
                    <Ionicons name="attach" size={16} color="#666" />
                    <Text className="text-sm text-black dark:text-white flex-1" numberOfLines={1}>
                        {attachment.name}
                    </Text>
                    <Pressable
                        onPress={() => setAttachment(null)}
                        className="h-8 w-8 items-center justify-center"
                    >
                        <Ionicons name="close" size={16} color="#666" />
                    </Pressable>
                </View>
            )}

            {/* Message Input */}
            <View className="p-3 border-t border-gray-200 dark:border-gray-800 flex-row gap-2 items-end">
                <TextInput
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Type a message..."
                    placeholderTextColor="#999"
                    className={`flex-1 h-9 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg px-3 ${isExpanded ? 'text-base h-10' : ''}`}
                    editable={!sending}
                    multiline
                    style={{ maxHeight: 100 }}
                />
                <Pressable 
                    onPress={handleSendMessage}
                    disabled={sending || (!newMessage.trim() && !attachment)}
                    className={`h-9 w-9 items-center justify-center rounded-lg ${sending || (!newMessage.trim() && !attachment) ? 'bg-gray-300 dark:bg-gray-700 opacity-50' : 'bg-yellow-500'}`}
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
