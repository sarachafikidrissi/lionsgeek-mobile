import { Alert } from 'react-native';
import { router } from 'expo-router';
import MoreHubScreen from '@/components/more/MoreHubScreen';

export default function AdminReportsScreen() {
  return (
    <MoreHubScreen
      eyebrow="Administration"
      icon="analytics"
      title="Reports & insights"
      description="Operational dashboards for attendance anomalies, engagement drops, and flagged content. Connect this screen to your backend admin endpoints when ready."
      bullets={[
        'Export-ready summaries for coaches & admins.',
        'Drill into cohorts, promotions, and sessions.',
        'Pair with Members directory for accountability.',
      ]}
      primaryAction={{
        label: 'Open members (admin)',
        onPress: () => router.push('/(tabs)/members'),
      }}
      secondaryAction={{
        label: 'Placeholder: sync API',
        onPress: () =>
          Alert.alert(
            'Backend hookup',
            'Wire GET admin/reports (or your analytics endpoint) here when the API is live.',
          ),
      }}
    />
  );
}
