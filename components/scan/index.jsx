import { useState } from 'react';
import { View, Text } from 'react-native';
import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import AppLayout from '@/components/layout/AppLayout';
import ScanTabBar from '@/components/scan/partials/ScanTabBar';
import EventsTab from '@/components/scan/partials/EventsTab';
import InfoSessionTab from '@/components/scan/partials/InfoSessionTab';
import AccessDenied from '@/components/scan/partials/AccessDenied';

export default function ScanScreen() {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState('events');

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View className="pt-12 pb-4 px-4 border-b border-beta/10 dark:border-light/10">
          <Text className="text-2xl font-bold text-beta dark:text-light">Scan</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 mt-1">
            Check in event visitors and info session participants
          </Text>
        </View>

        <ScanTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        <View className="flex-1">
          {activeTab === 'events' ? <EventsTab /> : <InfoSessionTab />}
        </View>
      </View>
    </AppLayout>
  );
}
