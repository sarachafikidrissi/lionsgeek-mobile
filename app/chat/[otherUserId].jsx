import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppContext } from '@/context';
import AppLayout from '@/components/layout/AppLayout';
import ChatBox from '@/components/chat/ChatBox';
import ChatThreadSkeleton from '@/components/chat/partials/ChatThreadSkeleton';
import API from '@/api';

export default function ChatThreadScreen() {
  const { token } = useAppContext();
  const params = useLocalSearchParams();
  const rawId = params.otherUserId;
  const otherUserId = useMemo(
    () => (Array.isArray(rawId) ? rawId[0] : rawId)?.toString().trim() ?? '',
    [rawId]
  );

  const [conversation, setConversation] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!token || !otherUserId) return;

    let cancelled = false;
    setLoadError(null);
    setConversation(null);

    (async () => {
      try {
        const response = await API.getWithAuth(`mobile/chat/conversation/${otherUserId}`, token);
        if (cancelled) return;
        if (response?.data?.conversation) {
          setConversation(response.data.conversation);
        } else {
          setLoadError('Could not open this conversation.');
        }
      } catch {
        if (!cancelled) setLoadError('Could not open this conversation.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, otherUserId]);

  if (!token) {
    return (
      <AppLayout showNavbar={true}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/60 dark:text-white/60 text-center">Please log in to access chat</Text>
        </View>
      </AppLayout>
    );
  }

  if (!otherUserId) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/60 dark:text-white/60 text-center">Invalid chat link.</Text>
        </View>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/80 dark:text-white/80 text-center mb-4">{loadError}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-alpha font-semibold">Go back</Text>
          </Pressable>
        </View>
      </AppLayout>
    );
  }

  if (!conversation) {
    return (
      <AppLayout showNavbar={false}>
        <ChatThreadSkeleton onBack={() => router.back()} />
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false}>
      <ChatBox
        conversation={conversation}
        onBack={() => router.back()}
        isExpanded={false}
        suppressMessageListLoadingSkeleton
      />
    </AppLayout>
  );
}
