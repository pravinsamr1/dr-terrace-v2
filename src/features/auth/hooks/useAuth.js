import { authRepository } from '../api/authRepository';

export function useAuth() {
  return {
    login: authRepository.login,
    logout: authRepository.logout,
    getUser: authRepository.getUser,
    getToken: authRepository.getToken,
  };
}

export default useAuth;
