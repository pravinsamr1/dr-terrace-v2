import { quotationRepository } from '../api/quotationRepository';

export function useQuotations() {
  return {
    repository: quotationRepository,
  };
}

export default useQuotations;
