import { useEffect, useState, type PropsWithChildren } from 'react';
import { AuthStore } from '../../services/auth/auth-store';
import { useServices } from '../../hooks/use-services';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const { auth } = useServices();
  const [store] = useState(() => new AuthStore(auth));
  useEffect(() => {
    void store.restore();
    return store.cancelPending;
  }, [store]);
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}
