import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function CustomizationScreen() {
  return (
    <MoreHubScreen
      eyebrow="Experience"
      icon="color-palette-outline"
      title="Customize experience"
      description="Tune how LionsGeek feels day to day. Appearance lives on the More screen; notification categories live under Notification preferences — we will expand granular toggles as preferences APIs ship."
      bullets={[
        'Dark mode & accent gold — tuned for focus.',
        'Per-type inbox filters from More → Notification preferences.',
        'Future: compact density, reduced motion, language packs.',
      ]}
      primaryAction={{ label: 'Notification preferences', onPress: () => router.push('/notification-preferences') }}
      secondaryAction={{ label: 'Back to More', onPress: () => router.push('/more') }}
    />
  );
}
