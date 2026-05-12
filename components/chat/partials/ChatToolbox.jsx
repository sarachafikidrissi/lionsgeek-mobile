import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import { useAppContext } from '@/context';
import Skeleton from '@/components/ui/Skeleton';

// Toolbox component dial attachments w posts
export default function ChatToolbox({ conversationId, otherUserId, onPreviewAttachment, messages = [] }) {
    const [attachments, setAttachments] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('attachments');
    const { token } = useAppContext();

    useEffect(() => {
        // Filter attachments from messages prop - pas audios
        if (messages && messages.length > 0) {
            const allAttachments = messages
                .filter(msg => msg.attachment_path && msg.attachment_type !== 'audio')
                .map(msg => ({
                    id: msg.id,
                    type: msg.attachment_type,
                    path: msg.attachment_path,
                    name: msg.attachment_name,
                    created_at: msg.created_at,
                }));
            setAttachments(allAttachments);
        }
        fetchPosts();
    }, [messages, otherUserId]);

    // Jib posts dial user b fetch
    const fetchPosts = async () => {
        try {
            setLoading(true);
            const response = await API.getWithAuth(`mobile/chat/user/${otherUserId}/posts`, token);
            
            if (response && response.data) {
                setPosts(response.data.posts || []);
            }
        } catch (error) {
            console.error('Failed to fetch posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = (attachment) => {
        if (attachment.type === 'image' || attachment.type === 'video') {
            onPreviewAttachment({
                type: attachment.type,
                path: attachment.path,
                name: attachment.name,
            });
        }
    };

    const getAttachmentIcon = (type) => {
        switch (type) {
            case 'image':
                return <Ionicons name="image" size={20} color="#ffc801" />;
            case 'video':
                return <Ionicons name="videocam" size={20} color="#ffc801" />;
            case 'audio':
                return <Ionicons name="attach" size={20} color="#ffc801" />;
            default:
                return <Ionicons name="document" size={20} color="#ffc801" />;
        }
    };

    return (
        <View className="w-full h-full bg-white dark:bg-gray-900 flex-col border-l border-gray-200 dark:border-gray-800">
            {/* Tabs */}
            <View className="p-4 border-b border-gray-200 dark:border-gray-800">
                <View className="flex-row gap-2">
                    <Pressable
                        onPress={() => setActiveTab('attachments')}
                        className={`flex-1 py-2 px-4 rounded-lg ${activeTab === 'attachments' ? 'bg-yellow-500' : 'bg-gray-100 dark:bg-gray-800'}`}
                    >
                        <Text className={`text-center font-medium ${activeTab === 'attachments' ? 'text-black' : 'text-gray-600 dark:text-gray-400'}`}>
                            Attachments
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setActiveTab('posts')}
                        className={`flex-1 py-2 px-4 rounded-lg ${activeTab === 'posts' ? 'bg-yellow-500' : 'bg-gray-100 dark:bg-gray-800'}`}
                    >
                        <Text className={`text-center font-medium ${activeTab === 'posts' ? 'text-black' : 'text-gray-600 dark:text-gray-400'}`}>
                            Posts
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* Content */}
            <ScrollView className="flex-1 p-4">
                {activeTab === 'attachments' ? (
                    loading ? (
                        <View className="items-center justify-center h-full">
                            <View className="w-full flex-row flex-wrap gap-2">
                                {Array.from({ length: 6 }).map((_, idx) => (
                                    <Skeleton key={idx} width="48%" height={140} borderRadius={12} isDark={false} />
                                ))}
                            </View>
                        </View>
                    ) : attachments.length === 0 ? (
                        <View className="items-center justify-center h-full">
                            <Ionicons name="attach" size={48} color="#999" />
                            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">No attachments yet</Text>
                        </View>
                    ) : (
                        <View className="flex-row flex-wrap gap-2">
                            {attachments.map((attachment) => {
                                const imageUrl = attachment.path.startsWith('/storage/') || attachment.path.startsWith('http')
                                    ? attachment.path
                                    : `${API.APP_URL}/storage/${attachment.path}`;
                                
                                return (
                                    <Pressable
                                        key={attachment.id}
                                        onPress={() => handlePreview(attachment)}
                                        className="w-[48%] aspect-square rounded-lg overflow-hidden"
                                    >
                                        {attachment.type === 'image' ? (
                                            <Image
                                                source={{ uri: imageUrl }}
                                                className="w-full h-full"
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View className="w-full h-full bg-gray-200 dark:bg-gray-700 items-center justify-center">
                                                {getAttachmentIcon(attachment.type)}
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )
                ) : (
                    posts.length === 0 ? (
                        <View className="items-center justify-center h-full">
                            <Ionicons name="link" size={48} color="#999" />
                            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">No posts shared yet</Text>
                        </View>
                    ) : (
                        <View className="gap-4">
                            {posts.map((post) => (
                                <Pressable key={post.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                                    {post.images && post.images.length > 0 && (
                                        <Image
                                            source={{ uri: `${API.APP_URL}/storage/img/posts/${post.images[0]}` }}
                                            className="w-full h-48 rounded-lg mb-2"
                                            resizeMode="cover"
                                        />
                                    )}
                                    <Text className="text-sm text-black dark:text-white" numberOfLines={2}>
                                        {post.description}
                                    </Text>
                                    <View className="flex-row items-center gap-4 mt-2">
                                        <Text className="text-xs text-gray-500 dark:text-gray-400">❤️ {post.likes_count}</Text>
                                        <Text className="text-xs text-gray-500 dark:text-gray-400">💬 {post.comments_count}</Text>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )
                )}
            </ScrollView>
        </View>
    );
}
