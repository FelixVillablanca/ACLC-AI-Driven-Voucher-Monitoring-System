import { createBrowserRouter } from 'react-router-dom'
import HomeRedirect from '@/app/HomeRedirect'
import RequireAuth from '@/app/guards/RequireAuth'
import RequireCompany from '@/app/guards/RequireCompany'
import RequireRole from '@/app/guards/RequireRole'
import { signOut } from '@/features/auth'
import { ACCOUNT_PATHS, PATHS, ROLES } from '@/lib/constants'
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
  categories: {
    security: PATHS.ADMIN_AUDIT_LOGS,
    access: `${PATHS.ADMIN_COMPANY_ACCESS}?view=requests`, // requests to join, invitation answers
    users: PATHS.ADMIN_USERS,
    departments: PATHS.ADMIN_DEPARTMENTS,
    companies: PATHS.ADMIN, // an Admin has one company: its news shows on the dashboard
    support: PATHS.ADMIN_NOTIFICATIONS, // a clerk's support message: answer it by email (the reply goes to them)
  },
}

/** Where the Super Admin bell panel's links go. */
const SUPERADMIN_NOTIFICATION_LINKS = {
  viewAll: PATHS.SUPERADMIN_NOTIFICATIONS,
  categories: {
    security: '?panel=security-alerts', // opens the Security alerts panel on the current page
    access: PATHS.SUPERADMIN_ADMINS,
    users: PATHS.SUPERADMIN_ADMINS,
    departments: PATHS.SUPERADMIN_COMPANIES,
    companies: PATHS.SUPERADMIN_COMPANIES,
    system: '?run=backup', // "Backup finished / failed": opens the backup dialog on the current page
  },
}

/** "All notifications": the same page for Admin and Super Admin; `links` says where a click goes. */
const notificationsPage = (path, links) => ({
  path,
  lazy: async () => {
    const { NotificationsPage } = await import('@/features/notifications')
    return { Component: () => <NotificationsPage links={links} /> }
  },
})

/** The 5 account menu pages (features/account, built code-first): the same pages for Admin and Super Admin. */
const accountPages = (paths) => [
  { path: paths.profile, lazy: page(() => import('@/features/account/pages/MyProfilePage')) },
  { path: paths.settings, lazy: page(() => import('@/features/account/pages/AccountSettingsPage')) },
  { path: paths.changePassword, lazy: page(() => import('@/features/account/pages/ChangePasswordPage')) },
  { path: paths.activity, lazy: page(() => import('@/features/account/pages/MyActivityPage')) },
  { path: paths.help, lazy: page(() => import('@/features/account/pages/HelpSupportPage')) },
]

/** Where the clerk's bell links go. Clerk pages beyond the dashboard come with the voucher forms. */
const CLERK_NOTIFICATION_LINKS = {
  viewAll: PATHS.CLERK_NOTIFICATIONS,
  types: { draft_expiry: PATHS.CLERK_DRAFTS }, // "A draft will be deleted…" opens Drafts
  voucher: (id) => `${PATHS.CLERK_VOUCHERS}/${id}`, // a notice about one voucher opens that voucher
  categories: {
    access: '?companies=manage', // invitations / answers open the Join another company window
    vouchers: PATHS.CLERK_VOUCHERS,
  },
}

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
                  const [
                    { default: AdminLayout },
                    { NotificationBell },
                    { CreateUserModal },
                    { AdminSearchBox },
                    { AddDepartmentModal },
                    { GrantAccessModal },
                  ] = await Promise.all([
                    import('@/components/layout/AdminLayout'),
                    import('@/features/notifications'),
                    import('@/features/admin/users'),
                    import('@/features/admin/search'),
                    import('@/features/admin/departments'),
                    import('@/features/admin/access'),
                  ])
                  return {
                    Component: () => (
                      <AdminLayout
                        onSignOut={signOut}
                        search={<AdminSearchBox />}
                        notifications={<NotificationBell links={ADMIN_NOTIFICATION_LINKS} />}
                        overlays={
                          <>
                            <CreateUserModal />
                            <AddDepartmentModal />
                            <GrantAccessModal />
                          </>
                        }
                      />
                    ),
                  }
                },
                children: [
                  { path: PATHS.ADMIN, lazy: page(() => import('@/features/admin/dashboard/pages/AdminDashboardPage')) },
                  // Not built yet: each gets its own Framer frame
                  { path: PATHS.ADMIN_DEPARTMENTS, lazy: page(() => import('@/features/admin/departments/pages/DepartmentsPage')) },
                  { path: PATHS.ADMIN_USERS, lazy: page(() => import('@/features/admin/users/pages/UsersPage')) },
                  { path: PATHS.ADMIN_COMPANY_ACCESS, lazy: page(() => import('@/features/admin/access/pages/CompanyAccessPage')) },
                  { path: PATHS.ADMIN_CATEGORIES, lazy: page(() => import('@/features/admin/catalog/pages/CategoriesPage')) },
                  { path: PATHS.ADMIN_AUDIT_LOGS, lazy: page(() => import('@/features/admin/audit/pages/AuditLogsPage')) },
                  // Account menu (⋮ under the user name, Framer nj06iziQJ)
                  ...accountPages(ACCOUNT_PATHS[ROLES.ADMIN]),
                  notificationsPage(PATHS.ADMIN_NOTIFICATIONS, ADMIN_NOTIFICATION_LINKS),
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
                    { RetryJobsDialog },
                  ] = await Promise.all([
                    import('@/components/layout/SuperAdminLayout'),
                    import('@/features/notifications'),
                    import('@/features/superadmin/admins'),
                    import('@/features/superadmin/security'),
                    import('@/features/superadmin/backups'),
                    import('@/features/superadmin/jobs'),
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
                            <RetryJobsDialog />
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
                  {
                    path: PATHS.SUPERADMIN_COMPANIES,
                    lazy: page(() => import('@/features/superadmin/companies/pages/CompaniesPage')),
                  },
                  {
                    path: PATHS.SUPERADMIN_SETTINGS,
                    lazy: page(() => import('@/features/superadmin/settings/pages/GlobalSettingsPage')),
                  },
                  {
                    path: PATHS.SUPERADMIN_AUDIT_LOGS,
                    lazy: page(() => import('@/features/superadmin/audit/pages/AuditLogsPage')),
                  },
                  {
                    path: PATHS.SUPERADMIN_SYSTEM_HEALTH,
                    lazy: page(() => import('@/features/superadmin/health/pages/SystemHealthPage')),
                  },
                  // Account menu (avatar in the top nav)
                  ...accountPages(ACCOUNT_PATHS[ROLES.SUPER_ADMIN]),
                  notificationsPage(PATHS.SUPERADMIN_NOTIFICATIONS, SUPERADMIN_NOTIFICATION_LINKS),
                ],
              },
            ],
          },

          // OPERATIONS areas: one per role, and ONLY that role may enter (others see 403).
          // Each also needs an active company. Officer and supervisor dashboards come from their Framer frames.
          // ACCOUNTING CLERK (Framer LolF6YFo5): dark sidebar + company switcher around every clerk page
          {
            element: <RequireRole roles={[ROLES.CLERK]} />,
            children: [
              {
                element: <RequireCompany />,
                children: [
                  {
                    lazy: async () => {
                      const [
                        { default: OperationsLayout },
                        { NotificationBell },
                        { ClerkNav },
                        { JoinCompanyModal, MANAGE_COMPANIES_SEARCH },
                      ] = await Promise.all([
                        import('@/components/layout/OperationsLayout'),
                        import('@/features/notifications'),
                        import('@/features/dashboard'),
                        import('@/features/joinCompany'),
                      ])
                      return {
                        Component: () => (
                          <OperationsLayout
                            nav={ClerkNav}
                            onSignOut={signOut}
                            notifications={<NotificationBell links={CLERK_NOTIFICATION_LINKS} />}
                            accountLinks={ACCOUNT_PATHS[ROLES.CLERK]}
                            manageCompaniesSearch={MANAGE_COMPANIES_SEARCH}
                            overlays={<JoinCompanyModal />}
                          />
                        ),
                      }
                    },
                    children: [
                      { path: PATHS.CLERK, lazy: page(() => import('@/features/dashboard/pages/ClerkDashboardPage')) },
                      notificationsPage(PATHS.CLERK_NOTIFICATIONS, CLERK_NOTIFICATION_LINKS),
                      // Vouchers (Phase 3)
                      { path: PATHS.CLERK_VOUCHERS, lazy: page(() => import('@/features/vouchers/pages/MyVouchersPage')) },
                      { path: PATHS.CLERK_VOUCHER_NEW, lazy: page(() => import('@/features/vouchers/pages/VoucherFormPage')) },
                      { path: PATHS.CLERK_DRAFTS, lazy: page(() => import('@/features/vouchers/pages/DraftsPage')) },
                      { path: PATHS.CLERK_RETURNED, lazy: page(() => import('@/features/vouchers/pages/ReturnedPage')) },
                      { path: PATHS.CLERK_PAYEES, lazy: page(() => import('@/features/payees/pages/PayeesPage')) },
                      { path: PATHS.CLERK_HELP, lazy: page(() => import('@/features/help/pages/HelpCenterPage')) },
                      { path: `${PATHS.CLERK_HELP}/:slug`, lazy: page(() => import('@/features/help/pages/GuidePage')) },
                      { path: `${PATHS.CLERK_VOUCHERS}/:id`, lazy: page(() => import('@/features/vouchers/pages/VoucherDetailPage')) },
                      { path: `${PATHS.CLERK_VOUCHERS}/:id/edit`, lazy: page(() => import('@/features/vouchers/pages/VoucherFormPage')) },
                      { path: PATHS.CLERK_APPROVAL_GUIDE, lazy: page(() => import('@/features/vouchers/pages/ApprovalGuidePage')) },
                      // ⋮ menu: the account pages that apply to a clerk
                      { path: PATHS.CLERK_PROFILE, lazy: page(() => import('@/features/account/pages/MyProfilePage')) },
                      { path: PATHS.CLERK_CHANGE_PASSWORD, lazy: page(() => import('@/features/account/pages/ChangePasswordPage')) },
                    ],
                  },
                ],
              },
            ],
          },
          roleArea(ROLES.OFFICER, PATHS.OFFICER),
          roleArea(ROLES.SUPERVISOR, PATHS.SUPERVISOR),
        ],
      },

      { path: PATHS.FORBIDDEN, lazy: page(() => import('@/pages/ForbiddenPage')) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
])
