import { expect, it } from 'vitest';
import { adminRoutes, guestRoutes, traderRoutes } from './route-definitions';
it('keeps shared public routes unique and protects private namespaces', () => {
  const paths = [...guestRoutes, ...traderRoutes, ...adminRoutes].map(
    (route) => route.path,
  );
  expect(new Set(paths).size).toBe(paths.length);
  expect(guestRoutes.every((route) => !route.path.startsWith('/admin'))).toBe(
    true,
  );
  expect(adminRoutes.every((route) => route.path.startsWith('/admin'))).toBe(
    true,
  );
  expect(guestRoutes.map((route) => route.path)).toContain('/markets/:symbol');
  expect(traderRoutes.map((route) => route.path)).toContain('/ai');
});
