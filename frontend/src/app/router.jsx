import { createBrowserRouter } from 'react-router-dom'
import HomeRedirect from '@/app/HomeRedirect'
import RequireAuth from '@/app/guards/RequireAuth'
import RequireCompany from '@/app/guards/RequireCompany'
import RequireRole from '@/app/guards/RequireRole'
import { OPERATIONAL_ROLES, PATHS, ROLES } from '@/lib/constants'
import RouteErrorPage from '@/pages/RouteErrorPage'

/**
 * THE MAP OF THE APP: which web address shows which page, and which guards protect it.
 *
 * `lazy` = the page's code is downloaded only when someone opens it
 * (clerks never download the admin pages -> faster app).
 */
const page = (importer) => async () => ({ Component: (await importer()).default })

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, path: PATHS.HOME, element: <HomeRedirect /> },

      // Public
      { path: PATHS.LOGIN, lazy: page(() => import('@/features/auth/pages/LoginPage')) }, // Framer p0wwkrh66
      { path: PATHS.STATUS, lazy: page(() => import('@/pages/SystemStatusPage')) }, // backend health check

      // ADMIN area: logged in + admin role only
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole roles={[ROLES.ADMIN]} />,
            children: [
              {
                path: PATHS.ADMIN,
                lazy: page(() => import('@/pages/ComingSoonPage')), // Phase 2: admin pages
              },
            ],
          },

          // OPERATIONS area: logged in + clerk/officer/supervisor + a company selected
          {
            element: <RequireRole roles={OPERATIONAL_ROLES} />,
            children: [
              {
                element: <RequireCompany />,
                children: [
                  {
                    path: PATHS.APP,
                    lazy: page(() => import('@/pages/ComingSoonPage')), // Phase 3+: voucher pages
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: PATHS.FORBIDDEN, lazy: page(() => import('@/pages/ForbiddenPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
