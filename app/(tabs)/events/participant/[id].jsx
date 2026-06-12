import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import AccessDenied from '@/components/events/partials/AccessDenied';
import ParticipantDetail from '@/components/events/partials/ParticipantDetail';

export default function ParticipantDetailScreen() {
  const { user } = useAppContext();

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  return <ParticipantDetail />;
}
