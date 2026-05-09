import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function SavedPostsScreen() {
  return (
    <MoreHubScreen
      eyebrow="Library"
      icon="bookmark"
      title="Saved posts"
      description="Collect articles, announcements, and threads you want to revisit. Sync with your account when the feed bookmark API is enabled."
      bullets={[
        'Pin important cohort posts and updates in one place.',
        'Offline-friendly reading is on the roadmap.',
        'Your saves stay private to your account.',
      ]}
      primaryAction={{ label: 'Go to home feed', onPress: () => router.push('/(tabs)/') }}
      secondaryAction={{ label: 'Search posts', onPress: () => router.push('/(tabs)/search') }}
    />
  );
}
