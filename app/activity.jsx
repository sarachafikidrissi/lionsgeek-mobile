import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function ActivityScreen() {
  return (
    <MoreHubScreen
      eyebrow="Timeline"
      icon="pulse"
      title="Recent activity"
      description="A unified timeline of check-ins, reservations, mentions, and achievements will aggregate here once activity feeds are exposed by the API."
      bullets={[
        'See training check-ins and QR scans.',
        'Track reservation changes and reminders.',
        'Jump back into threads from Notifications.',
      ]}
      primaryAction={{ label: 'Notifications', onPress: () => router.push('/(tabs)/notifications') }}
      secondaryAction={{ label: 'Training', onPress: () => router.push('/(tabs)/training') }}
    />
  );
}
