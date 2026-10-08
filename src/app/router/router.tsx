import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RouteFrame } from './RouteFrame';
import { RouteError } from './RouteError';
import {
  adminRoutes,
  guestOnlyRoutes,
  publicRoutes,
  toHandle,
  traderRoutes,
  type RouteDefinition,
} from './route-definitions';

/** Screens load on demand; each feature branch swaps in its real page. */
function screenRoute(route: RouteDefinition): RouteObject {
  return {
    path: route.path,
    handle: toHandle(route),
    lazy: async () => {
      const { PlaceholderPage } = await import('../../pages/PlaceholderPage');
      return { Component: PlaceholderPage };
    },
  };
}

export const routes: RouteObject[] = [
  {
    element: <RouteFrame />,
    errorElement: <RouteError />,
    children: [
      ...publicRoutes.map(screenRoute),
      ...guestOnlyRoutes.map(screenRoute),
      {
        element: <ProtectedRoute roles={['Trader']} />,
        children: traderRoutes.map(screenRoute),
      },
      {
        element: <ProtectedRoute roles={['Admin']} />,
        children: adminRoutes.map(screenRoute),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
