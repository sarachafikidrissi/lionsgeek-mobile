import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import RecordingIndicator from './RecordingIndicator';

export default function MessageList({
    messages,
    loading,
    /** When true, skip the full message skeleton after thread skeleton (single loading phase). */
    suppressInitialLoadingSkeleton,
    currentUser,
    conversation,
    isPlayingAudio,
    audioProgress,
    audioDuration,
    showMenuForMessage,
    onPlayAudio,
    onDeleteMessage,
    onMenuToggle,
    onPreviewAttachment,
    onDownloadAttachment,
    formatMessageTime,
    formatSeenTime,
    messagesEndRef,
    onScroll,
    showToolbox,
    previewAttachment,
    typingUsers = [],
    recordingUsers = [],
}) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const isCurrentUserMessage = (senderId) => {
        return String(senderId) === String(currentUser.id);
    };

    const MessageSkeleton = () => (
        <View className="gap-5 px-1 py-2 max-w-3xl mx-auto w-full">
            {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} className={`flex-row mb-1 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    {i % 2 !== 0 && (
                        <View className="h-7 w-7 rounded-lg bg-black/10 dark:bg-white/10 mr-2 mt-auto mb-1" />
                    )}
                    <View className="max-w-[78%] gap-2">
                        <View
                            className={`h-14 rounded-2xl ${
                                i % 2 === 0 ? 'bg-alpha/25 rounded-br-sm' : 'bg-black/[0.06] dark:bg-white/[0.08] rounded-bl-sm'
                            }`}
                        />
                        <View className={`h-3 w-16 rounded ${i % 2 === 0 ? 'self-end' : 'self-start'} bg-black/10 dark:bg-white/10`} />
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <ScrollView
            ref={messagesEndRef}
            className={`flex-1 bg-[#ebe8e2] dark:bg-[#101010] ${showToolbox && !previewAttachment ? 'w-2/3' : 'w-full'}`}
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={onScroll}
            scrollEventThrottle={16}
        >
            {loading && messages.length === 0 && !suppressInitialLoadingSkeleton ? (
                <MessageSkeleton />
            ) : loading && messages.length === 0 && suppressInitialLoadingSkeleton ? (
                <View className="flex-1 min-h-[200px] bg-[#ebe8e2] dark:bg-[#101010]" />
            ) : messages.length === 0 ? (
                <View className="flex-1 items-center justify-center min-h-[220px] px-6">
                    <View className="w-full max-w-xs rounded-3xl border border-dashed border-black/15 dark:border-white/15 bg-white/60 dark:bg-zinc-900/60 px-6 py-10 items-center">
                        <View className="rotate-6 mb-4">
                            <Ionicons name="reader-outline" size={48} color={isDark ? '#ffc801' : '#b38a00'} />
                        </View>
                        <Text className="text-base font-bold text-black dark:text-white text-center">Blank page</Text>
                        <Text className="text-sm text-black/50 dark:text-white/50 text-center mt-2 leading-5">
                            This thread has no lines yet. Send the first note — it will sit on the left rail like a margin
                            sketch.
                        </Text>
                    </View>
                </View>
            ) : (
                <View className="gap-1 pb-2">
                    {messages.map((message, index) => {
                        const isCurrentUser = isCurrentUserMessage(message.sender_id);
                        const showDateSeparator =
                            index === 0 ||
                            new Date(message.created_at).toDateString() !==
                                new Date(messages[index - 1].created_at).toDateString();

                        return (
                            <MessageItem
                                key={message.id}
                                message={message}
                                isCurrentUser={isCurrentUser}
                                currentUser={currentUser}
                                otherUser={conversation.other_user}
                                showDateSeparator={showDateSeparator}
                                isPlayingAudio={isPlayingAudio}
                                audioProgress={audioProgress}
                                audioDuration={audioDuration}
                                showMenuForMessage={showMenuForMessage}
                                onPlayAudio={onPlayAudio}
                                onDeleteMessage={onDeleteMessage}
                                onMenuToggle={onMenuToggle}
                                onPreviewAttachment={onPreviewAttachment}
                                onDownloadAttachment={onDownloadAttachment}
                                formatMessageTime={formatMessageTime}
                                formatSeenTime={formatSeenTime}
                            />
                        );
                    })}
                    {typingUsers.length > 0 &&
                        typingUsers.map((userId) => {
                            const user = userId === conversation.other_user.id ? conversation.other_user : null;
                            return user ? (
                                <TypingIndicator key={userId} userName={user.name} isCurrentUser={false} />
                            ) : null;
                        })}
                    {recordingUsers.length > 0 &&
                        recordingUsers.map((userId) => {
                            const user = userId === conversation.other_user.id ? conversation.other_user : null;
                            return user ? (
                                <RecordingIndicator key={userId} userName={user.name} isCurrentUser={false} />
                            ) : null;
                        })}
                </View>
            )}
        </ScrollView>
    );
}
