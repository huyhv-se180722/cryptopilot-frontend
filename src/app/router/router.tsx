import { createBrowserRouter } from 'react-router-dom';
import { GuestPage } from '../../pages/guest/GuestPage';
import { TraderPage } from '../../pages/trader/TraderPage';
import { AdminPage } from '../../pages/admin/AdminPage';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { RouteError } from './RouteError';
import { ProtectedRoute } from './ProtectedRoute';
import { RouteFrame } from './RouteFrame';
import { guestRoutes, traderRoutes, adminRoutes } from './route-definitions';

export const router = createBrowserRouter([
  {
    element: <RouteFrame />,
    errorElement: <RouteError />,
    children: [
      ...guestRoutes.map(({ path, title }) => ({
        path,
        element: <GuestPage title={title} />,
      })),
      {
        element: <ProtectedRoute roles={['Trader']} />,
        children: traderRoutes.map(({ path, title }) => ({
          path,
          element: <TraderPage title={title} />,
        })),
      },
      {
        element: <ProtectedRoute roles={['Admin']} />,
        children: adminRoutes.map(({ path, title }) => ({
          path,
          element: <AdminPage title={title} />,
        })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
