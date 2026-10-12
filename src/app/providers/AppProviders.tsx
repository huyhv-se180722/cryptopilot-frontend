import { useState, type PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Services } from '../../services/api/services';
import { ServicesContext } from './services-context';
import { AuthProvider } from './AuthProvider';
import { ErrorBoundary } from '../../components/feedback/ErrorBoundary';
import { I18nProvider } from '../../i18n/I18nProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { createQueryClient } from './query-client';

export function AppProviders({
  services,
  children,
}: PropsWithChildren<{ services: Services }>) {
  const [queryClient] = useState(createQueryClient);
  return (
    <I18nProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <ServicesContext.Provider value={services}>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                <AuthProvider>{children}</AuthProvider>
              </ToastProvider>
            </QueryClientProvider>
          </ServicesContext.Provider>
        </ErrorBoundary>
      </ThemeProvider>
    </I18nProvider>
  );
}
