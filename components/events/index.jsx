import { useState } from 'react';
import { View, Text } from 'react-native';
import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import AppLayout from '@/components/layout/AppLayout';
import ScanTabBar from '@/components/events/partials/ScanTabBar';
import EventsTab from '@/components/events/partials/EventsTab';
import InfoSessionsTab from '@/components/infoSession/partials/InfoSessionsTab';

export default function ScanScreen() {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState('events');
  const canAccessScan = userCanAccessScan(user);

  return (
    <AppLayout showNavbar={true}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View className="px-4 pt-4 pb-2 border-b border-beta/10 dark:border-light/10">
          <Text className="text-2xl font-bold text-beta dark:text-light">Events</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 mt-1">
            {canAccessScan
              ? 'Browse events and check in visitors or info session participants'
              : 'Browse upcoming and past events from lionsgeek.ma'}
          </Text>
        </View>

        {canAccessScan ? (
          <>
            <ScanTabBar activeTab={activeTab} onTabChange={setActiveTab} />
            <View className="flex-1">
              {activeTab === 'events' ? <EventsTab /> : <InfoSessionsTab />}
            </View>
          </>
        ) : (
          <View className="flex-1">
            <EventsTab />
          </View>
        )}
      </View>
    </AppLayout>
  );
}
