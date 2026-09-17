import EmployeeEditScreen from '../src/features/employees/screens/EmployeeEditScreen';
import { AdminOnlyGuard } from '../src/shared/components/RoleGuard';

export default function EmployeeEditRoute() {
  return (
    <AdminOnlyGuard>
      <EmployeeEditScreen />
    </AdminOnlyGuard>
  );
}
