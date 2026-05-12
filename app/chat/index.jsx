import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAppContext } from '@/context';
import AppLayout from '@/components/layout/AppLayout';
import ConversationsList from '@/components/chat/ConversationsList';

export default function ChatListScreen() {
  const { token } = useAppContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('chats');

  if (!token) {
    return (
      <AppLayout showNavbar={true}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <Text className="text-black/60 dark:text-white/60">Please log in to access chat</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout >
      <View className="flex-1 bg-neutral-100 dark:bg-[#0c0c0c]">
        <View className="px-4 pt-3 pb-2 bg-light dark:bg-dark border-b border-black/[0.06] dark:border-white/[0.08]">
          <View className="rounded-2xl border border-alpha/40 bg-alpha/12 dark:bg-alpha/8 px-3 py-2.5 flex-row items-center">
            <View className="w-1.5 h-1.5 rounded-full bg-alpha mr-2" />
            <Text className="text-xs text-black/70 dark:text-white/70 flex-1">
              {unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? 'conversation' : 'conversations'}`
                : 'No unread conversations'}
            </Text>
          </View>

          <View className="mt-3 flex-row bg-black/[0.04] dark:bg-white/[0.06] rounded-2xl p-1">
            {['chats', 'groups', 'calls'].map((tab) => {
              const selected = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-xl items-center ${selected ? 'bg-alpha' : ''}`}
                >
                  <Text
                    className={`text-xs font-semibold uppercase ${selected ? 'text-black' : 'text-black/55 dark:text-white/55'}`}
                  >
                    {tab}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="flex-1">
          {activeTab === 'chats' ? (
            <ConversationsList onUnreadCountChange={setUnreadCount} />
          ) : (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-lg font-bold text-black dark:text-white mb-1">
                {activeTab === 'groups' ? 'Groups' : 'Calls'}
              </Text>
              <Text className="text-sm text-black/55 dark:text-white/55 text-center">
                {activeTab === 'groups'
                  ? 'Groups section is ready for your API/data hookup.'
                  : 'Calls section is ready for your API/data hookup.'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </AppLayout>
  );
}
