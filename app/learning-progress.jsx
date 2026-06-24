import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function LearningProgressScreen() {
  return (
    <MoreHubScreen
      eyebrow="Journey"
      icon="trending-up"
      title="Learning progress"
      description="Track modules, sessions completed, and upcoming milestones. Connects with Training and attendance so you always know where you stand."
      bullets={[
        'Session timeline synced with Training hub.',
        'Attendance insights via QR check-ins.',
        'Goals and reminders surface in Notifications.',
      ]}
      primaryAction={{ label: 'Training hub', onPress: () => router.push('/(tabs)/training') }}
      secondaryAction={{
        label: 'Attendance history',
        onPress: () => router.push('/(tabs)/training/attendance'),
      }}
    />
  );
}
