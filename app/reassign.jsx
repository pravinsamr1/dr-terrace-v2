import ReassignScreen from '../src/features/appointments/screens/ReassignScreen';
import { AdminOnlyGuard } from '../src/shared/components/RoleGuard';

export default function ReassignRoute() {
  return (
    <AdminOnlyGuard>
      <ReassignScreen />
    </AdminOnlyGuard>
  );
}
