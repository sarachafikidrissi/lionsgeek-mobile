import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import AccessDenied from '@/components/events/partials/AccessDenied';
import ParticipantDetail from '@/components/events/partials/ParticipantDetail';

export default function ParticipantDetailScreen() {
  const { user } = useAppContext();

  if (!userCanAccessScan(user)) {
    return <AccessDenied />;
  }

  return <ParticipantDetail />;
}
