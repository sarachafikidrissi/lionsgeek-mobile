import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

function openChatThread(otherUserId, onBeforeNavigate) {
    const id = String(otherUserId ?? '').trim();
    if (!id) return;
    onBeforeNavigate?.();
    router.push(`/chat/${id}`);
}

// Component dial list dial conversations — thread opens as its own stack screen (native back gesture).
export default function ConversationsList({ onUnreadCountChange, onBeforeNavigateToThread }) {
    const { user, token } = useAppContext();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const currentUser = user;
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [contextConversation, setContextConversation] = useState(null);
    const searchTimeoutRef = useRef(null);

    // Fetch conversations b fetch
    const fetchConversations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await API.getWithAuth('mobile/chat', token);

            if (response && response.data) {
                const fetchedConversations = response.data.conversations || [];
                setConversations(fetchedConversations);

                const totalUnread = fetchedConversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                if (onUnreadCountChange) {
                    onUnreadCountChange(totalUnread);
                }
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    }, [token, onUnreadCountChange]);

    useFocusEffect(
        useCallback(() => {
            fetchConversations();
        }, [fetchConversations])
    );

    const handleConversationClick = (conversationId, otherUserId) => {
        openChatThread(otherUserId, onBeforeNavigateToThread);
    };

    // Search for users when typing
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearchingUsers(false);
            return;
        }

        setIsSearchingUsers(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await API.getWithAuth(`mobile/search?q=${encodeURIComponent(searchQuery)}&type=students`, token);

                if (response && response.data) {
                    const users = response.data.results || [];
                    
                    // Get following IDs to filter users
                    const followingResponse = await API.getWithAuth('mobile/chat/following-ids', token);
                    
                    let followingIds = [];
                    if (followingResponse && followingResponse.data) {
                        followingIds = followingResponse.data.following_ids || [];
                    }
                    
                    // Filter users: exclude current user and only show users we follow
                    const filteredUsers = users.filter(user => 
                        user.id !== currentUser.id && 
                        followingIds.includes(user.id)
                    );
                    
                    setSearchResults(filteredUsers);
                }
            } catch (error) {
                console.error('Failed to search users:', error);
                setSearchResults([]);
            } finally {
                setIsSearchingUsers(false);
            }
        }, 300);
    }, [searchQuery, currentUser?.id, token]);

    const viewerIsAdmin = userHasAdminRole(currentUser);
    const q = searchQuery.toLowerCase();
    const filteredConversations = conversations.filter((conv) => {
        const nameMatch = conv.other_user?.name?.toLowerCase().includes(q);
        const emailMatch =
            viewerIsAdmin && conv.other_user?.email?.toLowerCase().includes(q);
        return nameMatch || emailMatch;
    });

    // Handle user selection from search
    const handleUserSelect = (userId) => {
        setSearchQuery('');
        setSearchResults([]);
        openChatThread(userId, onBeforeNavigateToThread);
    };

    const handleDeleteConversation = async (conversationId) => {
        try {
            const response = await API.remove(`mobile/chat/conversation/${conversationId}`, token);
            if (response && response.status === 200) {
                setConversations(prev => prev.filter(c => c.id !== conversationId));
                fetchConversations();
            } else {
                Alert.alert('Error', 'Failed to delete conversation');
            }
        } catch (_error) {
            Alert.alert('Error', 'Failed to delete conversation');
        } finally {
            setContextConversation(null);
        }
    };

    const ph = isDark ? '#737373' : '#a3a3a3';
    const iconMuted = isDark ? '#525252' : '#a3a3a3';

    // Skeleton loader — “stacked cards”
    const ConversationListSkeleton = () => (
        <View className="px-4 pt-2 pb-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <View
                    key={i}
                    className="w-full flex-row overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900/80"
                >
                    <View className="w-1 bg-alpha/40" />
                    <View className="flex-1 flex-row items-center gap-3 p-3.5 pl-4">
                        <Skeleton width={52} height={52} borderRadius={14} isDark={isDark} />
                        <View className="flex-1 gap-2">
                            <View className="flex-row items-center justify-between">
                                <Skeleton width="55%" height={14} borderRadius={6} isDark={isDark} />
                                <Skeleton width={36} height={10} borderRadius={4} isDark={isDark} />
                            </View>
                            <Skeleton width="88%" height={12} borderRadius={6} isDark={isDark} />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <View className="flex-row flex-1 w-full bg-neutral-100 dark:bg-[#0c0c0c]">
            <View className="flex-col flex-1">
                <View className="px-4 pt-3 pb-3">
                    <Text className="text-[10px] font-semibold tracking-[0.2em] text-black/40 dark:text-white/40 mb-2">
                        FIND & FILTER
                    </Text>
                    <View className="flex-row items-center rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-zinc-900 px-3 py-0.5 shadow-sm shadow-black/5">
                        <Ionicons name="search" size={18} color={iconMuted} />
                        <TextInput
                            placeholder="Names, threads, or new contact…"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="flex-1 min-h-11 py-2.5 pl-2.5 text-sm text-black dark:text-white"
                            placeholderTextColor={ph}
                        />
                        {searchQuery.length > 0 ? (
                            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} className="p-1.5">
                                <Ionicons name="close-circle" size={18} color={iconMuted} />
                            </Pressable>
                        ) : null}
                    </View>

                    {searchQuery.trim() && searchResults.length > 0 && (
                        <View className="mt-3 rounded-2xl border border-alpha/40 bg-alpha/10 dark:bg-alpha/5 overflow-hidden">
                            <Text className="text-[10px] font-bold tracking-widest text-black/50 dark:text-white/50 px-3 pt-3 pb-1">
                                OPEN NEW THREAD
                            </Text>
                            <ScrollView className="max-h-56" nestedScrollEnabled>
                                {searchResults.map((u) => (
                                    <Pressable
                                        key={u.id}
                                        onPress={() => handleUserSelect(u.id)}
                                        className="flex-row items-center gap-3 px-3 py-3 border-t border-black/5 dark:border-white/10 active:bg-black/5 dark:active:bg-white/5"
                                    >
                                        {u.image || u.avatar ? (
                                            <Image
                                                source={{ uri: `${API.APP_URL}/storage/img/profile/${u.image || u.avatar}` }}
                                                className="h-11 w-11 rounded-2xl"
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View className="h-11 w-11 rounded-2xl bg-neutral-200 dark:bg-zinc-800 items-center justify-center">
                                                <Ionicons name="person" size={18} color={iconMuted} />
                                            </View>
                                        )}
                                        <View className="flex-1 min-w-0">
                                            <Text className="text-sm font-semibold text-black dark:text-white" numberOfLines={1}>
                                                {u.name}
                                            </Text>
                                            {viewerIsAdmin && u.email ? (
                                                <Text className="text-xs text-black/45 dark:text-white/45" numberOfLines={1}>
                                                    {u.email}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <Ionicons name="arrow-forward" size={16} color="#ffc801" />
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {searchQuery.trim() && isSearchingUsers && (
                        <View className="mt-3 items-center py-4">
                            <Skeleton width={22} height={22} borderRadius={11} isDark={isDark} />
                        </View>
                    )}

                    {searchQuery.trim() && !isSearchingUsers && searchResults.length === 0 && filteredConversations.length === 0 && (
                        <View className="mt-3 rounded-2xl border border-dashed border-black/15 dark:border-white/15 px-4 py-4">
                            <Text className="text-sm text-center text-black/55 dark:text-white/55">
                                No matches. Follow someone first, then search their name to open a thread.
                            </Text>
                        </View>
                    )}
                </View>

                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
                    {loading ? (
                        <ConversationListSkeleton />
                    ) : filteredConversations.length === 0 ? (
                        <View className="mx-4 mt-6 rounded-3xl border border-black/[0.07] dark:border-white/[0.09] bg-white dark:bg-zinc-900 overflow-hidden">
                            <View className="h-24 bg-alpha/25 items-center justify-center">
                                <View className="rotate-[-8deg] opacity-90">
                                    <Ionicons name="layers-outline" size={44} color={isDark ? '#ffc801' : '#c9a000'} />
                                </View>
                            </View>
                            <View className="px-6 py-8 items-center">
                                <Text className="text-lg font-bold text-black dark:text-white text-center">
                                    {searchQuery ? 'Empty shelf' : 'No threads yet'}
                                </Text>
                                <Text className="text-sm text-black/50 dark:text-white/50 text-center mt-2 leading-5">
                                    {searchQuery
                                        ? 'Nothing on the stack matches that search. Try another keyword.'
                                        : 'Your correspondence appears here as stacked cards—start from search above.'}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View className="px-4 pt-1 gap-3">
                            {filteredConversations.map((conversation) => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    currentUserId={currentUser?.id}
                                    isSelected={false}
                                    onClick={() => handleConversationClick(conversation.id, conversation.other_user.id)}
                                    onLongPress={() => setContextConversation(conversation)}
                                />
                            ))}
                        </View>
                    )}
                </ScrollView>
            </View>

            <Modal
                visible={Boolean(contextConversation)}
                transparent
                animationType="slide"
                onRequestClose={() => setContextConversation(null)}
            >
                <Pressable
                    onPress={() => setContextConversation(null)}
                    className="flex-1 bg-black/30 dark:bg-black/60 justify-end"
                >
                    <Pressable
                        onPress={(e) => e.stopPropagation()}
                        className="w-full rounded-t-3xl bg-white dark:bg-zinc-900 border-t border-l border-r border-black/[0.08] dark:border-white/[0.1] overflow-hidden pb-4"
                    >
                        <View className="items-center pt-2 pb-1">
                            <View className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20" />
                        </View>
                        <View className="px-5 pt-3 pb-3 border-b border-black/5 dark:border-white/10">
                            <Text className="text-[10px] font-bold tracking-[0.2em] text-black/45 dark:text-white/45 uppercase">
                                Conversation
                            </Text>
                            <Text className="text-base font-semibold text-black dark:text-white mt-1.5" numberOfLines={1}>
                                {contextConversation?.other_user?.name || 'Conversation'}
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => {
                                if (!contextConversation) return;
                                setContextConversation(null);
                                openChatThread(contextConversation.other_user.id, onBeforeNavigateToThread);
                            }}
                            className="mx-4 mt-4 px-4 py-3.5 flex-row items-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]"
                        >
                            <Ionicons name="chatbubble-ellipses-outline" size={18} color={isDark ? '#ddd' : '#333'} />
                            <Text className="ml-3 text-black dark:text-white font-semibold">Open conversation</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => contextConversation && handleDeleteConversation(contextConversation.id)}
                            className="mx-4 mt-2 px-4 py-3.5 flex-row items-center rounded-2xl bg-red-500/10"
                        >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            <Text className="ml-3 text-red-500 font-semibold">Delete conversation</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setContextConversation(null)}
                            className="mx-4 mt-2 px-4 py-3.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]"
                        >
                            <Text className="text-black/60 dark:text-white/60 font-semibold text-center">Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

function ConversationItem({ conversation, currentUserId, isSelected, onClick, onLongPress }) {
    const unread = conversation.unread_count > 0;
    const otherUserName = conversation.other_user?.name || 'User';
    const timeShort = conversation.last_message_at
        ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
            .replace('about ', '')
            .replace(' ago', '')
            .replace('less than a minute', 'now')
            .replace(' minutes', 'm')
            .replace(' minute', 'm')
            .replace(' hours', 'h')
            .replace(' hour', 'h')
            .replace(' days', 'd')
            .replace(' day', 'd')
            .replace(' weeks', 'w')
            .replace(' week', 'w')
            .replace(' months', 'mo')
            .replace(' month', 'mo')
        : '';

    const getLastMessagePreview = () => {
        if (!conversation.last_message) return 'Tap to open — blank thread';
        const { body, attachment_type, sender_id } = conversation.last_message;
        const isFromCurrentUser = sender_id === currentUserId;
        const prefix = isFromCurrentUser ? 'You: ' : `${otherUserName}: `;

        const isPostShare = (() => {
            if (!body) return false;
            if (typeof body === 'object') return body?.type === 'post_share' && !!body?.post_id;
            if (typeof body !== 'string') return false;
            const trimmed = body.trim();
            if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
            try {
                const parsed = JSON.parse(trimmed);
                return parsed?.type === 'post_share' && !!parsed?.post_id;
            } catch {
                return false;
            }
        })();
        
        if (attachment_type === 'image') return prefix + '📷 Image';
        if (attachment_type === 'video') return prefix + '🎥 Video';
        if (attachment_type === 'audio') return prefix + '🎤 Voice message';
        if (attachment_type === 'file') return prefix + '📎 File';
        if (isPostShare) return prefix + '📌 Post';
        if (body) {
            if (typeof body !== 'string') return prefix + 'Message';
            const preview = body.length > 80 ? body.substring(0, 80) + '...' : body;
            return prefix + preview;
        }
        return prefix + 'Attachment';
    };

    return (
        <View
            className={`rounded-2xl overflow-hidden border shadow-sm ${
                isSelected
                    ? 'border-alpha bg-alpha/12 dark:bg-alpha/10 shadow-alpha/20'
                    : unread
                        ? 'border-alpha/55 bg-alpha/[0.07] dark:bg-alpha/10 shadow-black/10'
                        : 'border-black/[0.07] dark:border-white/[0.09] bg-white dark:bg-zinc-900/90 shadow-black/5'
            }`}
        >
            <View className="flex-row">
                <View className={`w-1 ${unread ? 'bg-alpha' : 'bg-black/10 dark:bg-white/15'}`} />
                <Pressable
                    onPress={onClick}
                    onLongPress={onLongPress}
                    delayLongPress={280}
                    className="flex-1 flex-row items-stretch active:opacity-90 pl-3 pr-2 py-3.5"
                >
                    <View className="relative shrink-0 justify-center mr-3">
                        {conversation.other_user?.image ? (
                            <Image
                                source={{ uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}` }}
                                className="h-[52px] w-[52px] rounded-2xl"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="h-[52px] w-[52px] rounded-2xl bg-neutral-200 dark:bg-zinc-800 items-center justify-center">
                                <Text className="text-lg font-bold text-black/35 dark:text-white/35">
                                    {(conversation.other_user?.name || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        {unread ? (
                            <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-alpha border-2 border-white dark:border-zinc-900 items-center justify-center">
                                <Text className="text-[9px] font-extrabold text-black">
                                    {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    <View className="flex-1 min-w-0 justify-center pr-1">
                        <View className="flex-row items-baseline justify-between gap-2">
                            <Text
                                className={`text-[15px] flex-1 ${unread ? 'font-extrabold' : 'font-semibold'} text-black dark:text-white`}
                                numberOfLines={1}
                            >
                                {conversation.other_user?.name || 'User'}
                            </Text>
                            {timeShort ? (
                                <Text
                                    className={`text-[10px] uppercase tracking-wider shrink-0 ${
                                        unread ? 'text-alpha font-bold' : 'text-black/40 dark:text-white/40'
                                    }`}
                                >
                                    {timeShort}
                                </Text>
                            ) : null}
                        </View>
                        <Text
                            className={`text-xs mt-1 leading-4 ${unread ? 'text-black/80 dark:text-white/85 font-medium' : 'text-black/45 dark:text-white/45'}`}
                            numberOfLines={2}
                        >
                            {getLastMessagePreview()}
                        </Text>
                    </View>
                </Pressable>
            </View>
        </View>
    );
}
