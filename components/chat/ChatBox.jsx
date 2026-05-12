import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Alert, AppState, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';
import { useAppContext } from '@/context';
import API from '@/api';
import ChatHeader from './partials/ChatHeader';
import MessageList from './partials/MessageList';
import MessageInput from './partials/MessageInput';
import PreviewPanel from './partials/PreviewPanel';
import ChatToolbox from './partials/ChatToolbox';
import TypingIndicator from './partials/TypingIndicator';
import RecordingIndicator from './partials/RecordingIndicator';

// Main ChatBox component - refactored b components so9or
export default function ChatBox({ conversation, onBack, isExpanded, onExpand, suppressMessageListLoadingSkeleton }) {
    const { user, token } = useAppContext();
    const currentUser = user;
    const [messages, setMessages] = useState(conversation.messages || []);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioURL, setAudioURL] = useState(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(null);
    const [previewAttachment, setPreviewAttachment] = useState(null);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [audioProgress, setAudioProgress] = useState({});
    const [audioDuration, setAudioDuration] = useState({});
    const [showMenuForMessage, setShowMenuForMessage] = useState(null);
    const [showToolbox, setShowToolbox] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [recordingUsers, setRecordingUsers] = useState([]);
    const messagesEndRef = useRef(null);
    const recordingTimerRef = useRef(null);
    const pendingTempIdsRef = useRef(new Set());
    const typingTimeoutRef = useRef(null);
    const shouldAutoScrollRef = useRef(true);
    const nearBottomRef = useRef(true);

    // Poll for new messages
    useEffect(() => {
        fetchMessages();
        //  fetchMessages();
        // return () => clearInterval(interval);
    }, [conversation.id]);

    // Fetch messages - b3d ma y3tiw 3la conversation
    useEffect(() => {
        setMessages(prev => {
            return prev.filter(m => m.pending && pendingTempIdsRef.current.has(m.tempId));
        });
        shouldAutoScrollRef.current = true;
        fetchMessages();
    }, [conversation.id]);

    useEffect(() => {
        if (shouldAutoScrollRef.current) {
            setTimeout(() => scrollToBottom(), 30);
            shouldAutoScrollRef.current = false;
        }
    }, [messages]);

    // Update recording time timer
    useEffect(() => {
        if (isRecording && !isPaused) {
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
        
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, [isRecording, isPaused]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const response = await API.getWithAuth(`mobile/chat/conversation/${conversation.id}/messages`, token);

            if (response && response.data) {
                const fetchedMessages = response.data.messages || [];

                setMessages(prev => {
                    const pendingMessages = prev.filter(m => m.pending && pendingTempIdsRef.current.has(m.tempId));
                    const existingIds = new Set(fetchedMessages.map(m => m.id));
                    const stillPending = pendingMessages.filter(m => !existingIds.has(m.tempId));
                    return [...fetchedMessages, ...stillPending];
                });
                shouldAutoScrollRef.current = nearBottomRef.current;

                // Mark messages as read when conversation is opened
                const appState = AppState.currentState;
                if (appState === 'active') {
                    await API.postWithAuth(`mobile/chat/conversation/${conversation.id}/read`, {}, token).catch(err => console.error('Failed to mark as read:', err));
                }
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

    // Typing indicator functions (simplified for React Native)
    const startTyping = useCallback(() => {
        // In React Native, we can implement typing indicator via API calls
        // For now, just a placeholder
    }, []);

    const stopTyping = useCallback(() => {
        // Placeholder
    }, []);

    const startRecordingIndicator = useCallback(() => {
        // Placeholder
    }, []);

    const stopRecordingIndicator = useCallback(() => {
        // Placeholder
    }, []);

    const handleSendMessage = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if ((!newMessage.trim() && !attachment && !audioBlob) || sending) return;

        const messageBody = newMessage.trim();
        const tempId = Date.now();
        pendingTempIdsRef.current.add(tempId);
        
        // Create optimistic message
        const optimisticMessage = {
            id: tempId,
            tempId: tempId,
            pending: true,
            body: messageBody,
            sender_id: currentUser.id,
            sender: {
                id: currentUser.id,
                name: currentUser.name,
                image: currentUser.image,
            },
            attachment_path: null,
            attachment_type: null,
            attachment_name: null,
            attachment_size: null,
            is_read: false,
            read_at: null,
            created_at: new Date().toISOString(),
        };

        if (attachment) {
            optimisticMessage.attachment_path = attachment.uri;
            optimisticMessage.attachment_name = attachment.name;
            optimisticMessage.attachment_size = attachment.size;
            
            if (attachment.type.startsWith('image/')) {
                optimisticMessage.attachment_type = 'image';
            } else if (attachment.type.startsWith('video/')) {
                optimisticMessage.attachment_type = 'video';
            } else {
                optimisticMessage.attachment_type = 'file';
            }
        }

        if (audioBlob) {
            optimisticMessage.attachment_path = audioURL;
            optimisticMessage.attachment_type = 'audio';
            optimisticMessage.attachment_name = 'voice-message.m4a';
            optimisticMessage.attachment_size = audioBlob.size || 0;
        }

        setMessages(prev => [...prev, optimisticMessage]);
        shouldAutoScrollRef.current = true;

        const formMessageBody = messageBody;
        const formAttachment = attachment;
        const formAudioBlob = audioBlob;
        const prevAudioURL = audioURL;
        
        setNewMessage('');
        setAttachment(null);
        setAudioBlob(null);
        setAudioURL(null);
        setRecordingTime(0);

        setSending(true);
        
        try {
            const formData = new FormData();
            formData.append('body', formMessageBody || '');
            
            if (formAttachment) {
                // React Native FormData format for file uploads
                // Laravel expects the file to have uri, type, and name properties
                const fileExtension = formAttachment.name?.split('.').pop() || 
                    (formAttachment.type?.includes('image') ? 'jpg' : 
                     formAttachment.type?.includes('video') ? 'mp4' : 'file');
                const fileName = formAttachment.name || `attachment.${fileExtension}`;
                
                // Ensure proper MIME type
                let mimeType = formAttachment.type || 'application/octet-stream';
                if (!mimeType || mimeType === 'application/octet-stream') {
                    if (fileExtension === 'jpg' || fileExtension === 'jpeg') mimeType = 'image/jpeg';
                    else if (fileExtension === 'png') mimeType = 'image/png';
                    else if (fileExtension === 'mp4') mimeType = 'video/mp4';
                    else if (fileExtension === 'pdf') mimeType = 'application/pdf';
                }
                
                // React Native FormData file format
                const fileData = {
                    uri: formAttachment.uri,
                    type: mimeType,
                    name: fileName,
                };
                
                console.log('[CHATBOX] Uploading file:', {
                    fileName,
                    mimeType,
                    uri: formAttachment.uri.substring(0, 50) + '...',
                });
                
                formData.append('attachment', fileData);
                
                const attachmentType = mimeType.startsWith('image/') ? 'image' 
                    : mimeType.startsWith('video/') ? 'video' 
                    : 'file';
                formData.append('attachment_type', attachmentType);
            }
            
            if (formAudioBlob) {
                const audioData = {
                    uri: formAudioBlob.uri,
                    type: 'audio/m4a',
                    name: 'audio.m4a',
                };
                
                console.log('[CHATBOX] Uploading audio:', {
                    uri: formAudioBlob.uri.substring(0, 50) + '...',
                });
                
                formData.append('attachment', audioData);
                formData.append('attachment_type', 'audio');
            }

            const response = await API.postWithAuth(
                `mobile/chat/conversation/${conversation.id}/send`,
                formData,
                token
            );

            if (response && response.data) {
                const newMessageData = response.data.message;

                setMessages(prev => {
                    const filtered = prev.filter(msg => msg.tempId !== tempId);
                    const updated = filtered.map(msg => {
                        if (msg.sender_id !== currentUser.id && !msg.is_read) {
                            return {
                                ...msg,
                                is_read: true,
                                read_at: new Date().toISOString(),
                            };
                        }
                        return msg;
                    });
                    
                    const exists = updated.some(msg => msg.id === newMessageData.id);
                    if (!exists) {
                        return [...updated, {
                            ...newMessageData,
                            sender: newMessageData.sender || {
                                id: currentUser.id,
                                name: currentUser.name,
                                image: currentUser.image,
                            }
                        }];
                    }
                    return updated;
                });

                pendingTempIdsRef.current.delete(tempId);
                scrollToBottom();
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            setMessages(prev => prev.filter(msg => msg.tempId !== tempId));
            pendingTempIdsRef.current.delete(tempId);
            Alert.alert('Error', error.message || 'Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    // Format message time
    const formatMessageTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'few seconds ago';
        if (diffMins < 60) return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
        if (diffHours < 24 && isToday(date)) return format(date, 'h:mm a');
        if (isYesterday(date)) return `Yesterday at ${format(date, 'h:mm a')}`;
        if (diffDays < 7) return format(date, 'EEEE');
        return format(date, 'MMM d, yyyy');
    };

    const formatSeenTime = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        if (isToday(date)) return `Seen today at ${format(date, 'h:mm a')}`;
        if (isYesterday(date)) return `Seen yesterday at ${format(date, 'h:mm a')}`;
        return `Seen ${format(date, 'MMM d')}`;
    };

    const handlePlayAudio = (audioPath, messageId) => {
        setIsPlayingAudio(isPlayingAudio === messageId ? null : messageId);
    };

    const handleDeleteMessage = async (messageId) => {
        Alert.alert(
            'Delete Message',
            'Are you sure you want to delete this message?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await API.remove(`mobile/chat/message/${messageId}`, token);
                            setMessages(prev => prev.filter(msg => msg.id !== messageId));
                        } catch (error) {
                            Alert.alert('Error', error.message || 'Failed to delete message');
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadAttachment = async (attachmentPath, attachmentName) => {
        const url = attachmentPath.startsWith('/storage/') || attachmentPath.startsWith('http')
            ? attachmentPath
            : `${API.APP_URL}/storage/${attachmentPath}`;
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.error('Error opening URL:', error);
        }
    };

    const getAttachmentsForPreview = () => {
        return messages.filter(m => m.attachment_path && ['image', 'video'].includes(m.attachment_type))
            .map(m => ({ type: m.attachment_type, path: m.attachment_path, name: m.attachment_name }));
    };

    const handlePreviewAttachment = (att) => {
        const all = getAttachmentsForPreview();
        const idx = all.findIndex(a => a.path === att.path);
        setPreviewIndex(idx >= 0 ? idx : 0);
        setPreviewAttachment(all[idx >= 0 ? idx : 0]);
        setShowToolbox(false);
    };

    const handleNextPreview = () => {
        const all = getAttachmentsForPreview();
        if (all.length > 0) {
            const nextIndex = (previewIndex + 1) % all.length;
            setPreviewIndex(nextIndex);
            setPreviewAttachment(all[nextIndex]);
        }
    };

    const handlePreviousPreview = () => {
        const all = getAttachmentsForPreview();
        if (all.length > 0) {
            const prevIndex = (previewIndex - 1 + all.length) % all.length;
            setPreviewIndex(prevIndex);
            setPreviewAttachment(all[prevIndex]);
        }
    };

    const allAttachments = getAttachmentsForPreview();
    const hasMultipleAttachments = allAttachments.length > 1;

    // Handle file selection (from MessageInput)
    const handleFileSelect = (file) => {
        setAttachment(file);
    };

    // Recording functions (handled by VoiceRecorder component)
    const startRecording = () => {
        setIsRecording(true);
        setRecordingTime(0);
    };

    const stopRecording = () => {
        setIsRecording(false);
        stopRecordingIndicator();
    };

    const cancelRecording = () => {
        setIsRecording(false);
        setAudioBlob(null);
        setAudioURL(null);
        setRecordingTime(0);
        stopRecordingIndicator();
    };

    const pauseRecording = () => {
        setIsPaused(true);
    };

    const resumeRecording = () => {
        setIsPaused(false);
    };

    const handleListScroll = (event) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        const nearBottom = distanceFromBottom < 120;
        nearBottomRef.current = nearBottom;
    };

    return (
        <View className="bg-light dark:bg-dark flex-col flex-1 overflow-hidden relative">
            {/* Header stays fixed; only messages + composer avoid the keyboard (WhatsApp-style). */}
            <ChatHeader conversation={conversation} onBack={onBack} />

            {/* iOS: padding lifts content. Android + adjustResize: `height` avoids stacking resize + bottom padding. */}
            <KeyboardAvoidingView
                style={{
                    flex: 1,
                    width: '100%',
                    opacity: previewAttachment ? 0 : 1,
                }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                enabled
                keyboardVerticalOffset={0}
            >
                <View style={{ flex: 1, minHeight: 0 }}>
                    <MessageList
                        messages={messages}
                        loading={loading}
                        suppressInitialLoadingSkeleton={suppressMessageListLoadingSkeleton}
                        currentUser={currentUser}
                        conversation={conversation}
                        isPlayingAudio={isPlayingAudio}
                        audioProgress={audioProgress}
                        audioDuration={audioDuration}
                        showMenuForMessage={showMenuForMessage}
                        onPlayAudio={handlePlayAudio}
                        onDeleteMessage={handleDeleteMessage}
                        onMenuToggle={setShowMenuForMessage}
                        onPreviewAttachment={handlePreviewAttachment}
                        onDownloadAttachment={handleDownloadAttachment}
                        formatMessageTime={formatMessageTime}
                        formatSeenTime={formatSeenTime}
                        messagesEndRef={messagesEndRef}
                        showToolbox={false}
                        previewAttachment={previewAttachment}
                        typingUsers={typingUsers}
                        recordingUsers={recordingUsers}
                        onScroll={handleListScroll}
                    />
                </View>

                <MessageInput
                    newMessage={newMessage}
                    setNewMessage={setNewMessage}
                    sending={sending}
                    isRecording={isRecording}
                    recordingTime={recordingTime}
                    attachment={attachment}
                    setAttachment={setAttachment}
                    audioBlob={audioBlob}
                    audioURL={audioURL}
                    setAudioBlob={setAudioBlob}
                    setAudioURL={setAudioURL}
                    mediaRecorderRef={null}
                    fileInputRef={null}
                    handleFileSelect={handleFileSelect}
                    startRecording={startRecording}
                    stopRecording={stopRecording}
                    cancelRecording={cancelRecording}
                    handleSendMessage={handleSendMessage}
                    isExpanded={isExpanded}
                    audioDuration={audioDuration['preview']}
                    onTypingStart={startTyping}
                    onTypingStop={stopTyping}
                    isPaused={isPaused}
                    onPause={pauseRecording}
                    onResume={resumeRecording}
                />
            </KeyboardAvoidingView>

            {/* Preview Panel - Full Width */}
            {previewAttachment && (
                <View className="absolute inset-0 z-50 bg-white dark:bg-gray-900 flex-col">
                    <PreviewPanel
                        attachment={previewAttachment}
                        onClose={() => setPreviewAttachment(null)}
                        onPrevious={handlePreviousPreview}
                        onNext={handleNextPreview}
                        hasMultiple={hasMultipleAttachments}
                        currentIndex={previewIndex}
                        totalCount={allAttachments.length}
                    />
                </View>
            )}
        </View>
    );
}
