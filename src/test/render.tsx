import { StrictMode, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { createServices } from '../app/providers/create-services';
import { ServicesContext } from '../app/providers/services-context';
import { AuthProvider } from '../app/providers/AuthProvider';
import { I18nProvider } from '../i18n/I18nProvider';
import type { Services } from '../services/api/services';
import type { AuthService } from '../services/auth/contracts';
import type { Session } from '../types/domain';

/** Test-only principal; never imported by application modules. */
export const testTrader: Session = {
  user: {
    id: 'test-trader',
    email: 'trader@example.test',
    displayName: 'Test Trader',
    role: 'Trader',
    status: 'active',
  },
  entitlements: 'unknown',
};

export function fakeAuth(overrides: Partial<AuthService> = {}): AuthService {
  return {
    restoreSession: async () => null,
    login: async () => testTrader,
    register: async () => ({ messageCode: 'MSG05' }),
    verifyEmail: async () => ({ messageCode: 'MSG06' }),
    resendVerification: async () => ({ messageCode: 'MSG05' }),
    forgotPassword: async () => ({ messageCode: 'MSG12' }),
    resetPassword: async () => ({ messageCode: 'MSG13' }),
    logout: async () => undefined,
    ...overrides,
  };
}

/**
 * Renders routes inside the real providers (StrictMode, i18n, services,
 * session store) with an in-memory router starting at `path`.
 */
export async function renderRoutes(
  routes: RouteObject[],
  path: string,
  auth: AuthService = fakeAuth(),
  overrides: Partial<Omit<Services, 'auth'>> = {},
): Promise<ReturnType<typeof render>> {
  const base = await createServices({
    apiBaseUrl: '',
    wsUrl: '',
    useDevFixtures: false,
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <StrictMode>
      <I18nProvider>
        <ServicesContext.Provider value={{ ...base, ...overrides, auth }}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ServicesContext.Provider>
      </I18nProvider>
    </StrictMode>,
  );
}

export function page(path: string, element: ReactElement): RouteObject {
  return { path, element };
}
