import { employeeRepository } from '../api/employeeRepository';

export function useEmployees() {
  return {
    repository: employeeRepository,
  };
}

export default useEmployees;
