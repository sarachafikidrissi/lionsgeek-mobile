import { useAppContext } from '@/context';
import { userHasAdminRole } from '@/components/helpers/helpers';
import AccessDenied from '@/components/scan/partials/AccessDenied';
import EventScanner from '@/components/scan/partials/EventScanner';

export default function ScannerScreen() {
  const { user } = useAppContext();

  if (!userHasAdminRole(user)) {
    return <AccessDenied />;
  }

  return <EventScanner />;
}
