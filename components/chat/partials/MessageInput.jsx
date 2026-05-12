import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, Alert, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import AudioRecorder from './AudioRecorder';
import VoiceRecorder from '../VoiceRecorder';
import Skeleton from '@/components/ui/Skeleton';

// Conditionally import expo-image-picker
let ImagePicker = null;
try {
    ImagePicker = require('expo-image-picker');
} catch (_error) {
    console.warn('expo-image-picker not installed. Camera and photo library features will be disabled.');
}

// Component dial input dial message
export default function MessageInput({
    newMessage,
    setNewMessage,
    sending,
    isRecording,
    recordingTime,
    attachment,
    setAttachment,
    audioBlob,
    audioURL,
    setAudioBlob,
    setAudioURL,
    mediaRecorderRef,
    fileInputRef,
    handleFileSelect,
    startRecording,
    stopRecording,
    cancelRecording,
    handleSendMessage,
    isExpanded,
    audioDuration,
    onTypingStart,
    onTypingStop,
    isPaused,
    onPause,
    onResume,
}) {
    const colorScheme = useColorScheme();
    const insets = useSafeAreaInsets();
    const isDark = colorScheme === 'dark';
    const ph = isDark ? '#737373' : '#737373';

    // Typing indicator management
    const typingTimeoutRef = useRef(null);
    const hasTypedRef = useRef(false);
    const lastTypingTimeRef = useRef(0);

    // Handle typing events on input change - triggers typing indicator
    const handleInputChange = (value) => {
        setNewMessage(value);
        
        if (!onTypingStart || !onTypingStop) return;

        // Only trigger if user is actually typing (has content)
        if (value.trim().length > 0) {
            const now = Date.now();
            
            // Debounce typing start - only trigger every 1 second max
            if (!hasTypedRef.current || (now - lastTypingTimeRef.current) > 1000) {
                onTypingStart();
                hasTypedRef.current = true;
                lastTypingTimeRef.current = now;
            }
            
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            
            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                onTypingStop();
                hasTypedRef.current = false;
            }, 2000);
        } else {
            // Stop typing if input is cleared
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            onTypingStop();
            hasTypedRef.current = false;
        }
    };

    // Stop typing when message is sent or component unmounts
    useEffect(() => {
        if (!newMessage.trim() && hasTypedRef.current && onTypingStop) {
            onTypingStop();
            hasTypedRef.current = false;
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
        
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            if (hasTypedRef.current && onTypingStop) {
                onTypingStop();
            }
        };
    }, [newMessage, onTypingStop]);

    const isImageAttachment = (a) =>
        a?.uri &&
        (a.type?.startsWith?.('image/') ||
            /\.(jpe?g|png|gif|webp|heic)$/i.test(a.name || '') ||
            (!a.type && a.uri && !/\.(mp4|mov|webm|m4v|pdf|doc|zip)$/i.test(a.name || '')));

    const isVideoAttachment = (a) =>
        a?.uri && (a.type?.startsWith?.('video/') || /\.(mp4|mov|webm|m4v)$/i.test(a.name || ''));

    // Format audio duration
    const formatAudioDuration = (seconds) => {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Request permissions
    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web' && ImagePicker) {
                try {
                    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
                        Alert.alert('Permission needed', 'Camera and media library permissions are required to attach files.');
                    }
                } catch (error) {
                    console.warn('Failed to request image picker permissions:', error);
                }
            }
        })();
    }, []);

    // Show attachment options menu
    const showAttachmentMenu = () => {
        const options = [];
        
        if (ImagePicker) {
            options.push(
                {
                    text: 'Camera',
                    onPress: handleCameraCapture,
                    style: 'default',
                },
                {
                    text: 'Photo Library',
                    onPress: handleImagePicker,
                    style: 'default',
                }
            );
        }
        
        options.push(
            {
                text: 'Files',
                onPress: handleFilePicker,
                style: 'default',
            },
            {
                text: 'Cancel',
                style: 'cancel',
            }
        );
        
        Alert.alert(
            'Choose Attachment',
            'Select how you want to attach a file',
            options,
            { cancelable: true }
        );
    };

    // Handle camera capture
    const handleCameraCapture = async () => {
        if (!ImagePicker) {
            Alert.alert('Not Available', 'Camera feature requires expo-image-picker. Please run: npm install');
            return;
        }
        
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
                quality: 0.8,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    name: asset.uri.split('/').pop() || 'photo.jpg',
                    type: asset.type === 'image' ? 'image/jpeg' : asset.mimeType || 'image/jpeg',
                    size: asset.fileSize || 0,
                });
            }
        } catch (error) {
            console.error('Error capturing from camera:', error);
            Alert.alert('Error', 'Failed to capture image from camera');
        }
    };

    // Handle image picker (photo library)
    const handleImagePicker = async () => {
        if (!ImagePicker) {
            Alert.alert('Not Available', 'Photo library feature requires expo-image-picker. Please run: npm install');
            return;
        }
        
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
                quality: 0.8,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    name: asset.uri.split('/').pop() || (asset.type === 'image' ? 'photo.jpg' : 'video.mp4'),
                    type: asset.type === 'image' ? (asset.mimeType || 'image/jpeg') : (asset.mimeType || 'video/mp4'),
                    size: asset.fileSize || 0,
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image from library');
        }
    };

    // Handle file picker
    const handleFilePicker = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const file = result.assets[0];
                setAttachment({
                    uri: file.uri,
                    name: file.name,
                    type: file.mimeType,
                    size: file.size,
                });
            }
        } catch (error) {
            console.error('Error picking file:', error);
            Alert.alert('Error', 'Failed to pick file');
        }
    };

    return (
        <View
            className="px-3 pt-2 border-t border-black/[0.07] dark:border-white/[0.08] bg-[#ebe8e2] dark:bg-[#101010]"
            style={{ paddingBottom: Math.max(insets.bottom, 6) }}
        >
            {attachment && (
                <View className="mb-2 rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.12] bg-white dark:bg-zinc-900 shadow-sm shadow-black/10">
                    {isImageAttachment(attachment) ? (
                        <View className="relative">
                            <Image
                                source={{ uri: attachment.uri }}
                                style={{ width: '100%', height: 200 }}
                                resizeMode="cover"
                            />
                            <View className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/45">
                                <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                                    {attachment.name || 'Photo'}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setAttachment(null)}
                                hitSlop={10}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 items-center justify-center"
                            >
                                <Ionicons name="close" size={18} color="#fff" />
                            </Pressable>
                        </View>
                    ) : isVideoAttachment(attachment) ? (
                        <View className="relative w-full h-48 bg-zinc-900">
                            <View className="absolute inset-0 items-center justify-center">
                                <View className="w-16 h-16 rounded-full bg-white/15 items-center justify-center border border-white/25">
                                    <Ionicons name="play" size={34} color="#fff" style={{ marginLeft: 4 }} />
                                </View>
                            </View>
                            <View className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/55">
                                <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                                    {attachment.name || 'Video'}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setAttachment(null)}
                                hitSlop={10}
                                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 items-center justify-center"
                            >
                                <Ionicons name="close" size={18} color="#fff" />
                            </Pressable>
                        </View>
                    ) : (
                        <View className="flex-row items-center gap-3 px-3 py-3">
                            <View className="w-14 h-14 rounded-xl bg-alpha/20 items-center justify-center border border-alpha/35">
                                <Ionicons name="document-text" size={28} color="#ffc801" />
                            </View>
                            <View className="flex-1 min-w-0">
                                <Text className="text-sm font-semibold text-black dark:text-white" numberOfLines={2}>
                                    {attachment.name || 'File'}
                                </Text>
                                {attachment.size ? (
                                    <Text className="text-[11px] text-black/45 dark:text-white/45 mt-0.5">
                                        {(attachment.size / 1024).toFixed(1)} KB
                                    </Text>
                                ) : null}
                            </View>
                            <Pressable onPress={() => setAttachment(null)} hitSlop={8} className="p-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                                <Ionicons name="close" size={20} color={ph} />
                            </Pressable>
                        </View>
                    )}
                </View>
            )}

            {audioURL && audioBlob && (
                <View className="mb-2 rounded-2xl overflow-hidden border border-alpha/35 bg-alpha/8 dark:bg-alpha/10">
                    <View className="flex-row items-center gap-3 px-3 py-3">
                        <View className="w-12 h-12 rounded-2xl bg-alpha items-center justify-center shadow-sm shadow-black/20">
                            <Ionicons name="mic" size={22} color="#000" />
                        </View>
                        <View className="flex-1 min-w-0">
                            <Text className="text-sm font-bold text-black dark:text-white">Voice message</Text>
                            <Text className="text-[11px] text-black/50 dark:text-white/50 mt-0.5">Ready to send</Text>
                            {audioDuration ? (
                                <Text className="text-xs text-alpha font-semibold tabular-nums mt-1">
                                    {formatAudioDuration(audioDuration)}
                                </Text>
                            ) : null}
                        </View>
                        <View className="flex-row items-end gap-[2px] h-9 px-1">
                            {Array.from({ length: 16 }, (_, i) => (
                                <View
                                    key={i}
                                    className="w-[3px] rounded-full bg-alpha/80"
                                    style={{ height: 8 + (i % 5) * 4, opacity: 0.35 + ((i * 7) % 5) * 0.12 }}
                                />
                            ))}
                        </View>
                        <Pressable
                            onPress={() => {
                                setAudioBlob(null);
                                setAudioURL(null);
                            }}
                            hitSlop={8}
                            className="w-9 h-9 rounded-full bg-black/10 dark:bg-white/10 items-center justify-center"
                        >
                            <Ionicons name="trash-outline" size={18} color={ph} />
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Recording Indicator - Instagram Style */}
            {isRecording && (
                <View className="mb-2">
                    <AudioRecorder
                        onSend={() => {
                            stopRecording();
                            setTimeout(() => {
                                if (audioBlob) {
                                    handleSendMessage();
                                }
                            }, 100);
                        }}
                        onCancel={cancelRecording}
                        isRecording={isRecording}
                        isPaused={isPaused}
                        onPause={onPause}
                        onResume={onResume}
                        recordingTime={recordingTime}
                    />
                </View>
            )}

            <View className="flex-row gap-2 items-end bg-white dark:bg-zinc-900 rounded-[24px] border border-black/[0.08] dark:border-white/[0.1] px-1.5 py-1.5 shadow-sm shadow-black/10">
                <Pressable
                    onPress={showAttachmentMenu}
                    className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] items-center justify-center active:opacity-70"
                >
                    <Ionicons name="add" size={22} color="#ffc801" />
                </Pressable>

                <View className="flex-1">
                    <TextInput
                        value={newMessage}
                        onChangeText={handleInputChange}
                        placeholder="Write a line…"
                        placeholderTextColor={ph}
                        className="min-h-10 text-[15px] px-2 py-2 text-black dark:text-white"
                        editable={!sending && !isRecording}
                        multiline
                        style={{ maxHeight: 100 }}
                    />
                </View>

                {!isRecording ? (
                    <>
                        <VoiceRecorder
                            onRecordingComplete={(uri, duration, mimeType) => {
                                setAudioBlob({ uri });
                                setAudioURL(uri);
                            }}
                            onCancel={() => {
                                setAudioBlob(null);
                                setAudioURL(null);
                            }}
                            disabled={sending}
                            onSendAudioDirect={async (uri, duration, mimeType) => {
                                setAudioBlob({ uri });
                                setAudioURL(uri);
                            }}
                        />
                        <Pressable
                            onPress={handleSendMessage}
                            disabled={sending || (!newMessage.trim() && !attachment && !audioBlob)}
                            className={`w-11 h-11 rounded-2xl items-center justify-center border ${
                                sending || (!newMessage.trim() && !attachment && !audioBlob)
                                    ? 'bg-neutral-200 dark:bg-zinc-800 opacity-55 border-transparent'
                                    : 'bg-alpha active:opacity-90 border-black/10'
                            }`}
                        >
                            {sending ? (
                                <Skeleton width={16} height={16} borderRadius={8} isDark={isDark} />
                            ) : (
                                <Ionicons name="arrow-up" size={22} color="#000" />
                            )}
                        </Pressable>
                    </>
                ) : null}
            </View>
        </View>
    );
}
