import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function ProjectsHubScreen() {
  return (
    <MoreHubScreen
      eyebrow="Build"
      icon="cube-outline"
      title="Projects"
      description="Ship cohort projects, capstones, and team deliveries. Central place for briefs, repos links, and demo days — wired to Training when your admin enables modules."
      bullets={[
        'Attach repos & docs from your profile.',
        'Collaborate with peers via Chat.',
        'Reserve demo rooms under Reservations.',
      ]}
      primaryAction={{ label: 'Training & modules', onPress: () => router.push('/(tabs)/training') }}
      secondaryAction={{ label: 'Messages', onPress: () => router.push('/chat') }}
    />
  );
}
