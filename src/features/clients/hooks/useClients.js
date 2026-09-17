import { clientRepository } from '../api/clientRepository';

export function useClients() {
  return {
    repository: clientRepository,
  };
}

export default useClients;
