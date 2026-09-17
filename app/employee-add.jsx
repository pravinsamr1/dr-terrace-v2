import EmployeeAddScreen from '../src/features/employees/screens/EmployeeAddScreen';
import { AdminOnlyGuard } from '../src/shared/components/RoleGuard';

export default function EmployeeAddRoute() {
  return (
    <AdminOnlyGuard>
      <EmployeeAddScreen />
    </AdminOnlyGuard>
  );
}
