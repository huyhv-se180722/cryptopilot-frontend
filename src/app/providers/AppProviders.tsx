import type { PropsWithChildren } from 'react';
import type { Services } from '../../services/api/services';
import { ServicesContext } from './services-context';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { I18nProvider } from '../../i18n/I18nProvider';

export function AppProviders({
  services,
  children,
}: PropsWithChildren<{ services: Services }>) {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <ServicesContext.Provider value={services}>
          <AuthProvider>{children}</AuthProvider>
        </ServicesContext.Provider>
      </ErrorBoundary>
    </I18nProvider>
  );
}
