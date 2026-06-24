import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function AchievementsScreen() {
  return (
    <MoreHubScreen
      eyebrow="Recognition"
      icon="trophy"
      title="Achievements & badges"
      description="Celebrate streaks, milestones, and certifications. Badges will reflect training hours, attendance, and community milestones as your cohort unlocks them."
      bullets={[
        'Tier paths: Bronze → Silver → Gold spotlight.',
        'Leaderboard ties into coding hours and participation.',
        'Rare badges for mentors and event hosts.',
      ]}
      primaryAction={{ label: 'View leaderboard', onPress: () => router.push('/(tabs)/leaderboard') }}
      secondaryAction={{ label: 'Open profile', onPress: () => router.push('/(tabs)/profile') }}
    />
  );
}
