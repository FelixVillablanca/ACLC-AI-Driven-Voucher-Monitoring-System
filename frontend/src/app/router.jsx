import { createBrowserRouter } from 'react-router-dom'
import HomeRedirect from '@/app/HomeRedirect'
import RequireAdminCompany from '@/app/guards/RequireAdminCompany'
import RequireAuth from '@/app/guards/RequireAuth'
import RequireCompany from '@/app/guards/RequireCompany'
import RequireRole from '@/app/guards/RequireRole'
import { signOut } from '@/features/auth'
import { ACCOUNT_PATHS, PATHS, ROLES } from '@/lib/constants'
import RouteErrorPage from '@/pages/RouteErrorPage'
import { useAuthStore } from '@/stores/useAuthStore'

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

/** Where the officer's bell links go: a notice about a voucher opens its review page. */
const OFFICER_NOTIFICATION_LINKS = {
  viewAll: PATHS.OFFICER_NOTIFICATIONS,
  voucher: (id) => `${PATHS.OFFICER_VOUCHERS}/${id}`,
  types: {
    budget_alert: PATHS.OFFICER_BUDGETS, // a budget passed its alert: the Budgets page, not the voucher that did it
    report_ready: PATHS.OFFICER_REPORTS, // a financial report (or its AI summary) is ready
    anomaly_flagged: (id) => `${PATHS.OFFICER_FLAGGED}/${id}`, // a new flag → its Investigate page
  },
  categories: {
    access: '?companies=manage',
    vouchers: PATHS.OFFICER_QUEUE,
    budgets: PATHS.OFFICER_BUDGETS,
    reports: PATHS.OFFICER_REPORTS,
  },
}

/** Where the Supervisor's bell links go (2026-11-27): a voucher notice opens its final review page. */
const SUPERVISOR_NOTIFICATION_LINKS = {
  viewAll: PATHS.SUPERVISOR_NOTIFICATIONS,
  voucher: (id) => `${PATHS.SUPERVISOR_VOUCHERS}/${id}`,
  types: {
    budget_change: PATHS.SUPERVISOR_BUDGETS, // a budget change waits for sign-off (2026-11-27)
    report_signoff: `${PATHS.SUPERVISOR_REPORTS}?signoff=pending`, // a report waits for sign-off (2026-11-27)
  },
  categories: {
    access: '?companies=manage',
    vouchers: PATHS.SUPERVISOR_QUEUE,
    budgets: PATHS.SUPERVISOR_BUDGETS,
    reports: PATHS.SUPERVISOR_REPORTS,
  },
}

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
                    Component: function AdminShell() {
                      // no company yet: nothing to search or create (the pages show the waiting page)
                      const hasCompany = useAuthStore((s) => !!s.user?.company)
                      return (
                        <AdminLayout
                          onSignOut={signOut}
                          search={hasCompany ? <AdminSearchBox /> : null}
                          notifications={<NotificationBell links={ADMIN_NOTIFICATION_LINKS} />}
                          overlays={
                            hasCompany && (
                              <>
                                <CreateUserModal />
                                <AddDepartmentModal />
                                <GrantAccessModal />
                              </>
                            )
                          }
                        />
                      )
                    },
                  }
                },
                children: [
                  {
                    // An Admin with "No company yet" (2026-11-28) sees a waiting page here instead
                    element: <RequireAdminCompany />,
                    children: [
                      { path: PATHS.ADMIN, lazy: page(() => import('@/features/admin/dashboard/pages/AdminDashboardPage')) },
                      { path: PATHS.ADMIN_DEPARTMENTS, lazy: page(() => import('@/features/admin/departments/pages/DepartmentsPage')) },
                      { path: PATHS.ADMIN_USERS, lazy: page(() => import('@/features/admin/users/pages/UsersPage')) },
                      { path: PATHS.ADMIN_COMPANY_ACCESS, lazy: page(() => import('@/features/admin/access/pages/CompanyAccessPage')) },
                      { path: PATHS.ADMIN_CATEGORIES, lazy: page(() => import('@/features/admin/catalog/pages/CategoriesPage')) },
                      { path: PATHS.ADMIN_AUDIT_LOGS, lazy: page(() => import('@/features/admin/audit/pages/AuditLogsPage')) },
                    ],
                  },
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
                      { path: PATHS.CLERK_CHEQUES, lazy: page(() => import('@/features/cheques/pages/ChequeRegisterPage')) },
                      { path: PATHS.CLERK_HELP, lazy: page(() => import('@/features/help/pages/HelpCenterPage')) },
                      { path: `${PATHS.CLERK_HELP}/:slug`, lazy: page(() => import('@/features/help/pages/GuidePage')) },
                      { path: `${PATHS.CLERK_VOUCHERS}/:id`, lazy: page(() => import('@/features/vouchers/pages/VoucherDetailPage')) },
                      { path: `${PATHS.CLERK_VOUCHERS}/:id/edit`, lazy: page(() => import('@/features/vouchers/pages/VoucherFormPage')) },
                      { path: PATHS.CLERK_APPROVAL_GUIDE, lazy: page(() => import('@/features/vouchers/pages/ApprovalGuidePage')) },
                      // ⋮ menu: the account pages that apply to a clerk
                      { path: PATHS.CLERK_PROFILE, lazy: page(() => import('@/features/account/pages/MyProfilePage')) },
                      { path: PATHS.CLERK_SETTINGS, lazy: page(() => import('@/features/account/pages/AccountSettingsPage')) },
                      { path: PATHS.CLERK_CHANGE_PASSWORD, lazy: page(() => import('@/features/account/pages/ChangePasswordPage')) },
                    ],
                  },
                ],
              },
            ],
          },
          // ACCOUNTING OFFICER (Phase 4, Framer vZeEe5_Hq …): the Review queue is the landing page
          {
            element: <RequireRole roles={[ROLES.OFFICER]} />,
            children: [
              {
                element: <RequireCompany />,
                children: [
                  {
                    lazy: async () => {
                      const [
                        { default: OperationsLayout },
                        { NotificationBell },
                        { OfficerNav },
                        { JoinCompanyModal, MANAGE_COMPANIES_SEARCH },
                      ] = await Promise.all([
                        import('@/components/layout/OperationsLayout'),
                        import('@/features/notifications'),
                        import('@/features/approvals'),
                        import('@/features/joinCompany'),
                      ])
                      return {
                        Component: () => (
                          <OperationsLayout
                            nav={OfficerNav}
                            onSignOut={signOut}
                            notifications={<NotificationBell links={OFFICER_NOTIFICATION_LINKS} />}
                            accountLinks={ACCOUNT_PATHS[ROLES.OFFICER]}
                            manageCompaniesSearch={MANAGE_COMPANIES_SEARCH}
                            overlays={<JoinCompanyModal />}
                          />
                        ),
                      }
                    },
                    children: [
                      { path: PATHS.OFFICER, lazy: page(() => import('@/features/dashboard/pages/OfficerDashboardPage')) },
                      { path: PATHS.OFFICER_QUEUE, lazy: page(() => import('@/features/approvals/pages/ReviewQueuePage')) },
                      { path: `${PATHS.OFFICER_VOUCHERS}/:id`, lazy: page(() => import('@/features/approvals/pages/VoucherReviewPage')) },
                      { path: PATHS.OFFICER_REVIEWED, lazy: page(() => import('@/features/approvals/pages/ReviewedByMePage')) },
                      { path: PATHS.OFFICER_FLAGGED, lazy: page(() => import('@/features/approvals/pages/FlaggedPage')) },
                      { path: `${PATHS.OFFICER_FLAGGED}/:id`, lazy: page(() => import('@/features/approvals/pages/InvestigatePage')) },
                      { path: PATHS.OFFICER_HELP, lazy: page(() => import('@/features/help/pages/ReviewerHelpPage')) },
                      { path: `${PATHS.OFFICER_HELP}/:slug`, lazy: page(() => import('@/features/help/pages/GuidePage')) },
                      { path: PATHS.OFFICER_REPORTS, lazy: page(() => import('@/features/reports/pages/ReportsPage')) },
                      { path: `${PATHS.OFFICER_REPORTS}/:id`, lazy: page(() => import('@/features/reports/pages/ReportPage')) },
                      { path: PATHS.OFFICER_FORECASTS, lazy: page(() => import('@/features/forecasts/pages/ForecastsPage')) },
                      {
                        path: `${PATHS.OFFICER_FORECASTS}/:departmentId`,
                        lazy: page(() => import('@/features/forecasts/pages/DepartmentForecastPage')),
                      },
                      { path: PATHS.OFFICER_BUDGETS, lazy: page(() => import('@/features/budgets/pages/BudgetsPage')) },
                      { path: PATHS.OFFICER_CHEQUES, lazy: page(() => import('@/features/cheques/pages/ChequeRegisterPage')) },
                      {
                        path: `${PATHS.OFFICER_BUDGETS}/:departmentId`,
                        lazy: page(() => import('@/features/budgets/pages/DepartmentBudgetPage')),
                      },
                      notificationsPage(PATHS.OFFICER_NOTIFICATIONS, OFFICER_NOTIFICATION_LINKS),
                      { path: PATHS.OFFICER_PROFILE, lazy: page(() => import('@/features/account/pages/MyProfilePage')) },
                      { path: PATHS.OFFICER_SETTINGS, lazy: page(() => import('@/features/account/pages/AccountSettingsPage')) },
                      { path: PATHS.OFFICER_CHANGE_PASSWORD, lazy: page(() => import('@/features/account/pages/ChangePasswordPage')) },
                    ],
                  },
                ],
              },
            ],
          },
          // SUPERVISOR / MANAGER (Phase 4 Level 2, Framer RRXP4iCfd …, 2026-11-27): the Approval queue is the landing page
          {
            element: <RequireRole roles={[ROLES.SUPERVISOR]} />,
            children: [
              {
                element: <RequireCompany />,
                children: [
                  {
                    lazy: async () => {
                      const [
                        { default: OperationsLayout },
                        { NotificationBell },
                        { SupervisorNav },
                        { JoinCompanyModal, MANAGE_COMPANIES_SEARCH },
                      ] = await Promise.all([
                        import('@/components/layout/OperationsLayout'),
                        import('@/features/notifications'),
                        import('@/features/supervisor'),
                        import('@/features/joinCompany'),
                      ])
                      return {
                        Component: () => (
                          <OperationsLayout
                            nav={SupervisorNav}
                            onSignOut={signOut}
                            notifications={<NotificationBell links={SUPERVISOR_NOTIFICATION_LINKS} />}
                            accountLinks={ACCOUNT_PATHS[ROLES.SUPERVISOR]}
                            manageCompaniesSearch={MANAGE_COMPANIES_SEARCH}
                            overlays={<JoinCompanyModal />}
                          />
                        ),
                      }
                    },
                    children: [
                      { path: PATHS.SUPERVISOR, lazy: page(() => import('@/features/dashboard/pages/SupervisorDashboardPage')) },
                      { path: PATHS.SUPERVISOR_QUEUE, lazy: page(() => import('@/features/supervisor/pages/ApprovalQueuePage')) },
                      { path: `${PATHS.SUPERVISOR_VOUCHERS}/:id`, lazy: page(() => import('@/features/supervisor/pages/FinalReviewPage')) },
                      { path: PATHS.SUPERVISOR_HISTORY, lazy: page(() => import('@/features/supervisor/pages/DecisionHistoryPage')) },
                      { path: PATHS.SUPERVISOR_BUDGETS, lazy: page(() => import('@/features/supervisor/pages/SupervisorBudgetsPage')) },
                      { path: PATHS.SUPERVISOR_FORECASTS, lazy: page(() => import('@/features/supervisor/pages/SupervisorForecastsPage')) },
                      { path: PATHS.SUPERVISOR_CHEQUES, lazy: page(() => import('@/features/cheques/pages/ChequeRegisterPage')) },
                      { path: PATHS.SUPERVISOR_AUDIT, lazy: page(() => import('@/features/supervisor/pages/SupervisorAuditPage')) },
                      { path: PATHS.SUPERVISOR_REPORTS, lazy: page(() => import('@/features/supervisor/pages/SupervisorReportsPage')) },
                      {
                        path: `${PATHS.SUPERVISOR_REPORTS}/:id`,
                        lazy: page(() => import('@/features/supervisor/pages/SupervisorReportPage')),
                      },
                      { path: PATHS.SUPERVISOR_HELP, lazy: page(() => import('@/features/help/pages/ReviewerHelpPage')) },
                      { path: `${PATHS.SUPERVISOR_HELP}/:slug`, lazy: page(() => import('@/features/help/pages/GuidePage')) },
                      { path: PATHS.SUPERVISOR_FLAGGED, lazy: page(() => import('@/features/supervisor/pages/Level2FlaggedPage')) },
                      {
                        path: `${PATHS.SUPERVISOR_FLAGGED}/:id`,
                        lazy: page(() => import('@/features/supervisor/pages/InvestigateFlagPage')),
                      },
                      notificationsPage(PATHS.SUPERVISOR_NOTIFICATIONS, SUPERVISOR_NOTIFICATION_LINKS),
                      { path: PATHS.SUPERVISOR_PROFILE, lazy: page(() => import('@/features/account/pages/MyProfilePage')) },
                      { path: PATHS.SUPERVISOR_SETTINGS, lazy: page(() => import('@/features/account/pages/AccountSettingsPage')) },
                      { path: PATHS.SUPERVISOR_CHANGE_PASSWORD, lazy: page(() => import('@/features/account/pages/ChangePasswordPage')) },
                    ],
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
