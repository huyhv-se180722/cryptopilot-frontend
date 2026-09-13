import type { PropsWithChildren } from 'react';
import type { Services } from '../../services/api/services';
import { ServicesContext } from './services-context';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';

export function AppProviders({
  services,
  children,
}: PropsWithChildren<{ services: Services }>) {
  return (
    <ErrorBoundary>
      <ServicesContext.Provider value={services}>
        <AuthProvider>{children}</AuthProvider>
      </ServicesContext.Provider>
    </ErrorBoundary>
  );
}
