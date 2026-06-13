import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import AccessDenied from '@/components/events/partials/AccessDenied';
import InfoSessionsTab from '@/components/infoSession/partials/InfoSessionsTab';

export default function InfoSessionIndexScreen() {
  const { user } = useAppContext();

  if (!userCanAccessScan(user)) {
    return <AccessDenied />;
  }

  return <InfoSessionsTab />;
}
