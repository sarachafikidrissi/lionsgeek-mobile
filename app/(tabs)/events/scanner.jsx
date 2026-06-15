import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import AccessDenied from '@/components/events/partials/AccessDenied';
import EventScanner from '@/components/events/partials/EventScanner';

export default function ScannerScreen() {
  const { user } = useAppContext();

  if (!userCanAccessScan(user)) {
    return <AccessDenied />;
  }

  return <EventScanner />;
}
