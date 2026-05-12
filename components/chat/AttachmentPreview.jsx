import React, { useState } from 'react';
import { View, Text, Pressable, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';

export default function AttachmentPreview({ attachment, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    
    if (!attachment) return null;

    const isImage = attachment.type === 'image' || attachment.path?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    const isVideo = attachment.type === 'video' || attachment.path?.match(/\.(mp4|webm|mov|avi)$/i);
    const attachments = Array.isArray(attachment) ? attachment : [attachment];

    const currentAttachment = attachments[currentIndex];
    const hasMultiple = attachments.length > 1;

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? attachments.length - 1 : prev - 1));
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === attachments.length - 1 ? 0 : prev + 1));
    };

    const handleDownload = async () => {
        const url = currentAttachment.path.startsWith('/storage/') || currentAttachment.path.startsWith('http')
            ? currentAttachment.path
            : `${API.APP_URL}/storage/${currentAttachment.path}`;
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.error('Error opening URL:', error);
        }
    };

    const imageUrl = currentAttachment.path.startsWith('/storage/') || currentAttachment.path.startsWith('http')
        ? currentAttachment.path
        : `${API.APP_URL}/storage/${currentAttachment.path}`;

    return (
        <View className="absolute inset-0 z-[200] bg-black/90 items-center justify-center">
            <View className="relative w-full h-full items-center justify-center p-4">
                {/* Close Button */}
                <Pressable
                    onPress={onClose}
                    className="absolute top-4 right-4 z-10 h-10 w-10 bg-gray-800/80 items-center justify-center rounded-full"
                >
                    <Ionicons name="close" size={20} color="#fff" />
                </Pressable>

                {/* Previous Button */}
                {hasMultiple && (
                    <Pressable
                        onPress={goToPrevious}
                        className="absolute left-4 z-10 h-12 w-12 bg-gray-800/80 items-center justify-center rounded-full"
                    >
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </Pressable>
                )}

                {/* Next Button */}
                {hasMultiple && (
                    <Pressable
                        onPress={goToNext}
                        className="absolute right-4 z-10 h-12 w-12 bg-gray-800/80 items-center justify-center rounded-full"
                    >
                        <Ionicons name="chevron-forward" size={24} color="#fff" />
                    </Pressable>
                )}

                {/* Main Content */}
                <View className="max-w-[90vw] max-h-[90vh] items-center justify-center">
                    {isImage && currentAttachment.path && (
                        <Image
                            source={{ uri: imageUrl }}
                            className="max-w-full max-h-[90vh] rounded-lg"
                            resizeMode="contain"
                        />
                    )}

                    {isVideo && currentAttachment.path && (
                        <View className="w-full h-full items-center justify-center">
                            <Ionicons name="videocam" size={64} color="#fff" />
                            <Text className="text-white mt-4">Video preview - use expo-av Video component</Text>
                        </View>
                    )}

                    {!isImage && !isVideo && currentAttachment.path && (
                        <View className="bg-gray-800 rounded-lg p-12 items-center gap-4 max-w-md">
                            <Ionicons name="document" size={96} color="#ffc801" />
                            <Text className="text-white text-center font-medium">{currentAttachment.name || 'Attachment'}</Text>
                            <Pressable
                                onPress={handleDownload}
                                className="bg-yellow-500 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-black font-semibold">Download</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Download Button */}
                {currentAttachment.path && (
                    <Pressable
                        onPress={handleDownload}
                        className="absolute bottom-4 right-4 z-10 h-12 w-12 bg-gray-800/80 items-center justify-center rounded-full"
                    >
                        <Ionicons name="download" size={20} color="#fff" />
                    </Pressable>
                )}

                {/* Counter */}
                {hasMultiple && (
                    <View className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-gray-800/80">
                        <Text className="text-white text-sm">
                            {currentIndex + 1} / {attachments.length}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}
