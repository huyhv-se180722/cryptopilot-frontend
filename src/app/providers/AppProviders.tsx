import type { PropsWithChildren } from 'react';
import type { Services } from '../../services/api/services';
import { ServicesContext } from './services-context';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { I18nProvider } from '../../i18n/I18nProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';

export function AppProviders({
  services,
  children,
}: PropsWithChildren<{ services: Services }>) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <ServicesContext.Provider value={services}>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </ServicesContext.Provider>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nProvider>
  );
}
