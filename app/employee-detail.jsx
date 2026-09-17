import EmployeeDetailScreen from '../src/features/employees/screens/EmployeeDetailScreen';
import { AdminOnlyGuard } from '../src/shared/components/RoleGuard';

export default function EmployeeDetailRoute() {
  return (
    <AdminOnlyGuard>
      <EmployeeDetailScreen />
    </AdminOnlyGuard>
  );
}
