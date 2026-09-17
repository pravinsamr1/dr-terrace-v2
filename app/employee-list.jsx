import EmployeeListScreen from '../src/features/employees/screens/EmployeeListScreen';
import { AdminOnlyGuard } from '../src/shared/components/RoleGuard';

export default function EmployeeListRoute() {
  return (
    <AdminOnlyGuard>
      <EmployeeListScreen />
    </AdminOnlyGuard>
  );
}
