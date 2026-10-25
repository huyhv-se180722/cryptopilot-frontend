import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestOnlyRoute } from './GuestOnlyRoute';
import { ReaderRoute } from './ReaderRoute';
import { RouteFrame } from './RouteFrame';
import { RouteError } from './RouteError';
import { GuestShell } from '../layouts/GuestShell';
import { AuthShell } from '../layouts/AuthShell';
import { TraderShell } from '../layouts/TraderShell';
import { AdminShell } from '../layouts/AdminShell';
import {
  academyReadRoutes,
  adminRoutes,
  communityReadRoutes,
  guestOnlyRoutes,
  publicRoutes,
  toHandle,
  paperRoutes,
  traderRoutes,
  type RouteDefinition,
} from './route-definitions';
import { screenPages } from './screen-pages';

/** Screens load on demand; each feature branch swaps in its real page. */
function screenRoute(route: RouteDefinition): RouteObject {
  return {
    path: route.path,
    handle: toHandle(route),
    lazy:
      screenPages[route.path] ??
      (async () => ({
        Component: (await import('../../pages/PlaceholderPage'))
          .PlaceholderPage,
      })),
  };
}

export const routes: RouteObject[] = [
  {
    element: <RouteFrame />,
    errorElement: <RouteError />,
    children: [
      {
        element: <GuestShell />,
        children: [
          ...publicRoutes.map(screenRoute),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        element: <ReaderRoute />,
        children: [...communityReadRoutes, ...academyReadRoutes].map(
          screenRoute,
        ),
      },
      {
        element: <GuestOnlyRoute />,
        children: [
          {
            element: <AuthShell />,
            children: guestOnlyRoutes.map(screenRoute),
          },
        ],
      },
      {
        element: <ProtectedRoute roles={['Trader']} />,
        children: [
          {
            element: <TraderShell />,
            children: [...traderRoutes, ...paperRoutes].map(screenRoute),
          },
        ],
      },
      {
        element: <ProtectedRoute roles={['Admin']} />,
        children: [
          { element: <AdminShell />, children: adminRoutes.map(screenRoute) },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
