import type { ComponentType } from 'react';

type PageModule = () => Promise<{ Component: ComponentType }>;

/** Routes whose real screen exists; every other route shows its placeholder. */
export const screenPages: Readonly<Record<string, PageModule>> = {
  '/login': async () => ({
    Component: (await import('../../pages/guest/LoginPage')).LoginPage,
  }),
};
