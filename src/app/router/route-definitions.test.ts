import { describe, expect, it } from 'vitest';
import { en } from '../../i18n/locales/en';
import { traderNav } from '../layouts/navigation';
import {
  DIALOG_SCREENS,
  adminRoutes,
  guestOnlyRoutes,
  paperRoutes,
  publicRoutes,
  traderRoutes,
} from './route-definitions';

const all = [
  ...publicRoutes,
  ...guestOnlyRoutes,
  ...traderRoutes,
  ...adminRoutes,
];

describe('route definitions', () => {
  it('keeps every path unique', () => {
    const paths = all.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('covers every routed SRS screen SCR-01…44 and no dialog screen', () => {
    const screens = new Set<string>(all.map((route) => route.screen));
    for (let n = 1; n <= 44; n++) {
      const id = 'SCR-' + String(n).padStart(2, '0');
      if (DIALOG_SCREENS.includes(id as `SCR-${string}`))
        expect(screens.has(id)).toBe(false);
      else expect(screens.has(id), id).toBe(true);
    }
  });

  it('keeps the admin console under /admin and nothing else there', () => {
    expect(adminRoutes.every((route) => route.path.startsWith('/admin'))).toBe(
      true,
    );
    const others = [...publicRoutes, ...guestOnlyRoutes, ...traderRoutes];
    expect(others.some((route) => route.path.startsWith('/admin'))).toBe(false);
  });

  it('gives guests only the registration and sign-in screens (SRS 3.1.3)', () => {
    expect(guestOnlyRoutes.map((route) => route.screen).sort()).toEqual([
      'SCR-02',
      'SCR-03',
      'SCR-04',
      'SCR-05',
      'SCR-06',
    ]);
    expect(publicRoutes.map((route) => route.screen)).toEqual(['SCR-01']);
  });

  it('offers Profile & Settings to traders and the security tab to admins', () => {
    expect(traderRoutes.find((r) => r.screen === 'SCR-07')?.path).toBe(
      '/profile',
    );
    expect(adminRoutes.find((r) => r.screen === 'SCR-07')?.path).toBe(
      '/admin/account',
    );
  });

  it('has an English title for every route', () => {
    for (const route of all) expect(en.screens[route.titleKey]).toBeTruthy();
  });

  it('traces demo trading to D-86 under /trade, off until its flag is set', () => {
    expect(paperRoutes.map((route) => [route.path, route.screen])).toEqual([
      ['/trade/spot', 'D-86'],
      ['/trade/spot/:symbol', 'D-86'],
      ['/trade/wallet', 'D-86'],
      ['/trade/orders', 'D-86'],
    ]);
    const others = [...publicRoutes, ...guestOnlyRoutes, ...traderRoutes];
    expect(others.some((route) => route.path.startsWith('/trade'))).toBe(false);
    // VITE_ENABLE_PAPER_TRADING is not set in tests (D-101).
    expect(traderNav.some((item) => item.to.startsWith('/trade'))).toBe(false);
  });
});
