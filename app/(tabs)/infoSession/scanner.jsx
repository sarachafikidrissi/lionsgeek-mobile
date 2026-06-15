import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import AccessDenied from '@/components/events/partials/AccessDenied';
import InfoSessionScanner from '@/components/infoSession/partials/InfoSessionScanner';

export default function InfoSessionScannerScreen() {
  const { user } = useAppContext();

  if (!userCanAccessScan(user)) {
    return <AccessDenied />;
  }

  return <InfoSessionScanner />;
}
