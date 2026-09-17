import { appointmentRepository } from '../api/appointmentRepository';

export function useAppointments() {
  return {
    repository: appointmentRepository,
  };
}

export default useAppointments;
