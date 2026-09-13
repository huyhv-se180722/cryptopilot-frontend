import { useContext, useSyncExternalStore } from 'react';
import { AuthContext } from '../app/providers/auth-context';

export function useAuth() {
  const store = useContext(AuthContext);
  if (!store) throw new Error('Auth provider is missing.');
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return {
    ...state,
    login: store.login,
    register: store.register,
    logout: store.logout,
    restore: store.restore,
  };
}
