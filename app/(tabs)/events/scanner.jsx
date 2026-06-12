import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import AccessDenied from '@/components/events/partials/AccessDenied';
import EventScanner from '@/components/events/partials/EventScanner';

export default function ScannerScreen() {
  const { user } = useAppContext();

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  return <EventScanner />;
}
