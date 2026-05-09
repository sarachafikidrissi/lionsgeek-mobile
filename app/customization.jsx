import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function CustomizationScreen() {
  return (
    <MoreHubScreen
      eyebrow="Experience"
      icon="color-palette-outline"
      title="Customize experience"
      description="Tune how LionsGeek feels day to day. Appearance lives on the More screen; notification cadence lives with Alerts — we’ll expand granular toggles as preferences APIs ship."
      bullets={[
        'Dark mode & accent gold — tuned for focus.',
        'Notification categories from the Alerts tab.',
        'Future: compact density, reduced motion, language packs.',
      ]}
      primaryAction={{ label: 'Notification settings', onPress: () => router.push('/(tabs)/notifications') }}
      secondaryAction={{ label: 'Back to More', onPress: () => router.push('/more') }}
    />
  );
}
