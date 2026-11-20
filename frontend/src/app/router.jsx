import { createBrowserRouter } from 'react-router-dom'
import HomeRedirect from '@/app/HomeRedirect'
import RequireAuth from '@/app/guards/RequireAuth'
import RequireCompany from '@/app/guards/RequireCompany'
import RequireRole from '@/app/guards/RequireRole'
import { signOut } from '@/features/auth'
import { PATHS, ROLES } from '@/lib/constants'
import RouteErrorPage from '@/pages/RouteErrorPage'

/**
 * THE MAP OF THE APP: which web address shows which page, and which guards protect it.
 *
 * `lazy` = the page's code is downloaded only when someone opens it
 * (clerks never download the admin pages -> faster app).
 */
const page = (importer) => async () => ({ Component: (await importer()).default })

/** Where the admin bell panel's links go (Framer D7aTKQEDz). Clicking a notification opens its category's page. */
const ADMIN_NOTIFICATION_LINKS = {
  viewAll: PATHS.ADMIN_NOTIFICATIONS,
  settings: PATHS.ADMIN_SETTINGS,
  categories: {
    security: PATHS.ADMIN_AUDIT_LOGS,
    access: PATHS.ADMIN_COMPANY_ACCESS,
    users: PATHS.ADMIN_USERS,
    departments: PATHS.ADMIN_DEPARTMENTS,
    companies: PATHS.ADMIN_COMPANIES,
  },
}

/** Where the Super Admin bell panel's links go. */
const SUPERADMIN_NOTIFICATION_LINKS = {
  viewAll: PATHS.SUPERADMIN_NOTIFICATIONS,
  settings: PATHS.SUPERADMIN_ACCOUNT,
  categories: {
    security: '?panel=security-alerts', // opens the Security alerts panel on the current page
    access: PATHS.SUPERADMIN_ADMINS,
    users: PATHS.SUPERADMIN_ADMINS,
    departments: PATHS.SUPERADMIN_COMPANIES,
    companies: PATHS.SUPERADMIN_COMPANIES,
    system: '?run=backup', // "Backup finished / failed": opens the backup dialog on the current page
  },
}

/** A route for a screen that isn't built yet (shows "coming soon" inside the layout). */
const comingSoon = (path, title) => ({
  path,
  lazy: async () => {
    const { default: ComingSoonPage } = await import('@/pages/ComingSoonPage')
    return {
      Component: () => (
        <ComingSoonPage className="py-24" title={`${title}: coming soon`} description="This screen is built from its own Framer frame." />
      ),
    }
  },
})

/** A landing area that only ONE operational role can open, e.g. /clerk for accounting clerks. */
const roleArea = (role, path) => ({
  element: <RequireRole roles={[role]} />,
  children: [{ element: <RequireCompany />, children: [{ path, lazy: page(() => import('@/pages/RoleHomePage')) }] }],
})

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, path: PATHS.HOME, element: <HomeRedirect /> },

      // Public
      { path: PATHS.LOGIN, lazy: page(() => import('@/features/auth/pages/LoginPage')) }, // Framer p0wwkrh66
      { path: PATHS.SET_PASSWORD, lazy: page(() => import('@/features/auth/pages/SetPasswordPage')) }, // invitation link
      { path: PATHS.STATUS, lazy: page(() => import('@/pages/SystemStatusPage')) }, // backend health check

      // ADMIN area: logged in + admin role only
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireRole roles={[ROLES.ADMIN]} />,
            children: [
              {
                // Sidebar + top bar around every admin page (Framer Nhw7N27tM)
                lazy: async () => {
                  // Downloaded only when the admin area opens (keeps the login page small)
                  const [{ default: AdminLayout }, { NotificationBell }, { CreateUserModal }] = await Promise.all([
                    import('@/components/layout/AdminLayout'),
                    import('@/features/notifications'),
                    import('@/features/admin/users'),
                  ])
                  return {
                    Component: () => (
                      <AdminLayout
                        onSignOut={signOut}
                        notifications={<NotificationBell links={ADMIN_NOTIFICATION_LINKS} />}
                        overlays={<CreateUserModal />}
                      />
                    ),
                  }
                },
                children: [
                  { path: PATHS.ADMIN, lazy: page(() => import('@/features/admin/dashboard/pages/AdminDashboardPage')) },
                  // Not built yet: each gets its own Framer frame
                  comingSoon(PATHS.ADMIN_COMPANIES, 'Companies'),
                  comingSoon(PATHS.ADMIN_DEPARTMENTS, 'Departments'),
                  comingSoon(PATHS.ADMIN_USERS, 'Users'),
                  comingSoon(PATHS.ADMIN_COMPANY_ACCESS, 'Company Access'),
                  comingSoon(PATHS.ADMIN_CATEGORIES, 'Categories'),
                  comingSoon(PATHS.ADMIN_AUDIT_LOGS, 'Audit Logs'),
                  // Account menu (⋮ under the user name, Framer nj06iziQJ)
                  comingSoon(PATHS.ADMIN_PROFILE, 'My profile'),
                  comingSoon(PATHS.ADMIN_SETTINGS, 'Account settings'),
                  comingSoon(PATHS.ADMIN_CHANGE_PASSWORD, 'Change password'),
                  comingSoon(PATHS.ADMIN_HELP, 'Help & support'),
                  comingSoon(PATHS.ADMIN_NOTIFICATIONS, 'All notifications'),
                ],
              },
            ],
          },

          // SUPER ADMIN area: the platform owner only (no company needed, no vouchers ever)
          {
            element: <RequireRole roles={[ROLES.SUPER_ADMIN]} />,
            children: [
              {
                // White top navigation around every Super Admin page (Framer uH0wO9f5O)
                lazy: async () => {
                  const [
                    { default: SuperAdminLayout },
                    { NotificationBell },
                    { AddAdminModal },
                    { SecurityAlertsPanel },
                    { RunBackupDialog },
                  ] = await Promise.all([
                    import('@/components/layout/SuperAdminLayout'),
                    import('@/features/notifications'),
                    import('@/features/superadmin/admins'),
                    import('@/features/superadmin/security'),
                    import('@/features/superadmin/backups'),
                  ])
                  return {
                    Component: () => (
                      <SuperAdminLayout
                        onSignOut={signOut}
                        notifications={<NotificationBell links={SUPERADMIN_NOTIFICATION_LINKS} />}
                        overlays={
                          <>
                            <AddAdminModal />
                            <SecurityAlertsPanel />
                            <RunBackupDialog />
                          </>
                        }
                      />
                    ),
                  }
                },
                children: [
                  {
                    path: PATHS.SUPERADMIN,
                    lazy: page(() => import('@/features/superadmin/dashboard/pages/SuperAdminDashboardPage')),
                  },
                  // Designed in Framer, built next (see the frame table in CLAUDE.md)
                  {
                    path: PATHS.SUPERADMIN_ADMINS,
                    lazy: page(() => import('@/features/superadmin/admins/pages/AdminAccountsPage')),
                  },
                  comingSoon(PATHS.SUPERADMIN_COMPANIES, 'Companies'),
                  comingSoon(PATHS.SUPERADMIN_SETTINGS, 'Global settings'),
                  comingSoon(PATHS.SUPERADMIN_AUDIT_LOGS, 'Audit logs'),
                  comingSoon(PATHS.SUPERADMIN_SYSTEM_HEALTH, 'System health'),
                  comingSoon(PATHS.SUPERADMIN_PROFILE, 'My profile'),
                  comingSoon(PATHS.SUPERADMIN_ACCOUNT, 'Account settings'),
                  comingSoon(PATHS.SUPERADMIN_CHANGE_PASSWORD, 'Change password'),
                  comingSoon(PATHS.SUPERADMIN_HELP, 'Help & support'),
                  comingSoon(PATHS.SUPERADMIN_NOTIFICATIONS, 'All notifications'),
                ],
              },
            ],
          },

          // OPERATIONS areas: one per role, and ONLY that role may enter (others see 403).
          // Each also needs an active company. The real dashboards come from their Framer frames.
          roleArea(ROLES.CLERK, PATHS.CLERK),
          roleArea(ROLES.OFFICER, PATHS.OFFICER),
          roleArea(ROLES.SUPERVISOR, PATHS.SUPERVISOR),
        ],
      },

      { path: PATHS.FORBIDDEN, lazy: page(() => import('@/pages/ForbiddenPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
