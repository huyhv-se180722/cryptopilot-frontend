import type { ComponentType } from 'react';

type PageModule = () => Promise<{ Component: ComponentType }>;

/** Routes whose real screen exists; every other route shows its placeholder. */
export const screenPages: Readonly<Record<string, PageModule>> = {
  '/': async () => ({
    Component: (await import('../../pages/guest/PublicHomePage'))
      .PublicHomePage,
  }),
  '/login': async () => ({
    Component: (await import('../../pages/guest/LoginPage')).LoginPage,
  }),
  '/register': async () => ({
    Component: (await import('../../pages/guest/RegisterPage')).RegisterPage,
  }),
  '/verify-email': async () => ({
    Component: (await import('../../pages/guest/VerifyEmailPage'))
      .VerifyEmailPage,
  }),
  '/forgot-password': async () => ({
    Component: (await import('../../pages/guest/ForgotPasswordPage'))
      .ForgotPasswordPage,
  }),
  '/reset-password': async () => ({
    Component: (await import('../../pages/guest/ResetPasswordPage'))
      .ResetPasswordPage,
  }),
  '/markets': async () => ({
    Component: (await import('../../pages/trader/MarketsPage')).MarketsPage,
  }),
  '/profile': async () => ({
    Component: (await import('../../pages/trader/ProfilePage')).ProfilePage,
  }),
  '/admin/account': async () => ({
    Component: (await import('../../pages/admin/AdminAccountPage'))
      .AdminAccountPage,
  }),
};
