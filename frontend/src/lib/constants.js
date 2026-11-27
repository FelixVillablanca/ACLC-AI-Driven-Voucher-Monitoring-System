// Values that never change, kept in ONE place so a typo can't sneak in.

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  CLERK: 'accounting_clerk',
  OFFICER: 'accounting_officer',
  SUPERVISOR: 'supervisor_manager',
})

// Short role names for badges/pills (Framer user menu: "Admin")
export const ROLE_SHORT_LABELS = Object.freeze({
  super_admin: 'Super Admin',
  admin: 'Admin',
  accounting_clerk: 'Clerk',
  accounting_officer: 'Officer',
  supervisor_manager: 'Supervisor',
})

export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: 'Super Administrator',
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.CLERK]: 'Accounting Clerk',
  [ROLES.OFFICER]: 'Accounting Officer',
  [ROLES.SUPERVISOR]: 'Supervisor / Manager',
})

// Each role's own email domain (CLAUDE.md "Domain emails"). The backend uses the same list
// (app/Domain/Identity/Support/RoleEmailDomains.php) and builds the real address itself.
export const ROLE_EMAIL_DOMAINS = Object.freeze({
  [ROLES.SUPER_ADMIN]: 'Superadmin.com', // made only by `php artisan superadmin:create`
  [ROLES.ADMIN]: 'Administrator.com',
  [ROLES.CLERK]: 'Clerk.com',
  [ROLES.OFFICER]: 'Officer.com',
  [ROLES.SUPERVISOR]: 'Supervisor.com',
})

// Roles that work with vouchers (admin is setup-only)
export const OPERATIONAL_ROLES = [ROLES.CLERK, ROLES.OFFICER, ROLES.SUPERVISOR]

export const VOUCHER_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
})

export const PATHS = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  SET_PASSWORD: '/set-password', // link in the invitation email
  ADMIN: '/admin',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_USERS: '/admin/users',
  ADMIN_COMPANY_ACCESS: '/admin/company-access',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_PROFILE: '/admin/profile',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_CHANGE_PASSWORD: '/admin/change-password',
  ADMIN_HELP: '/admin/help',
  ADMIN_ACTIVITY: '/admin/activity',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  // Super Admin console (Framer uH0wO9f5O top nav + account menu)
  SUPERADMIN: '/superadmin',
  SUPERADMIN_ADMINS: '/superadmin/admins',
  SUPERADMIN_COMPANIES: '/superadmin/companies',
  SUPERADMIN_SETTINGS: '/superadmin/settings',
  SUPERADMIN_AUDIT_LOGS: '/superadmin/audit-logs',
  SUPERADMIN_SYSTEM_HEALTH: '/superadmin/system-health',
  SUPERADMIN_PROFILE: '/superadmin/profile',
  SUPERADMIN_ACCOUNT: '/superadmin/account',
  SUPERADMIN_CHANGE_PASSWORD: '/superadmin/change-password',
  SUPERADMIN_HELP: '/superadmin/help',
  SUPERADMIN_ACTIVITY: '/superadmin/activity',
  SUPERADMIN_NOTIFICATIONS: '/superadmin/notifications',
  CLERK: '/clerk',
  CLERK_NOTIFICATIONS: '/clerk/notifications',
  CLERK_VOUCHERS: '/clerk/vouchers',
  CLERK_VOUCHER_NEW: '/clerk/vouchers/new',
  CLERK_DRAFTS: '/clerk/drafts',
  CLERK_RETURNED: '/clerk/returned',
  CLERK_PAYEES: '/clerk/payees',
  CLERK_HELP: '/clerk/help',
  CLERK_PROFILE: '/clerk/profile',
  CLERK_CHANGE_PASSWORD: '/clerk/change-password',
  CLERK_APPROVAL_GUIDE: '/clerk/how-vouchers-get-approved',
  OFFICER: '/officer', // the officer's dashboard = landing page (Framer tfDekIe0N, 2026-11-27)
  OFFICER_QUEUE: '/officer/queue', // the Review queue (was the landing page until 2026-11-27)
  OFFICER_VOUCHERS: '/officer/vouchers', // /officer/vouchers/:id = review one voucher
  OFFICER_REVIEWED: '/officer/reviewed',
  OFFICER_FLAGGED: '/officer/flagged', // /officer/flagged/:id = investigate one flag
  OFFICER_HELP: '/officer/help', // /officer/help/:slug = one guide (2026-11-27)
  OFFICER_REPORTS: '/officer/reports', // /officer/reports/:id = one financial report (2026-11-27)
  OFFICER_FORECASTS: '/officer/forecasts', // /officer/forecasts/:departmentId = one department's forecast (2026-11-27)
  OFFICER_BUDGETS: '/officer/budgets', // /officer/budgets/:departmentId = one department's yearly budget (2026-11-27)
  OFFICER_NOTIFICATIONS: '/officer/notifications',
  OFFICER_PROFILE: '/officer/profile',
  OFFICER_CHANGE_PASSWORD: '/officer/change-password',
  SUPERVISOR: '/supervisor', // the Supervisor's dashboard = landing page (Framer YKfX_oJ3a, 2026-11-27)
  SUPERVISOR_QUEUE: '/supervisor/queue', // the Approval queue (Framer RRXP4iCfd; the landing page until the dashboard came)
  SUPERVISOR_VOUCHERS: '/supervisor/vouchers', // /supervisor/vouchers/:id = final review of one voucher
  SUPERVISOR_HISTORY: '/supervisor/history', // Decision history
  SUPERVISOR_BUDGETS: '/supervisor/budgets', // ?request={id}[&mode=decline] opens the sign-off window (Framer adI8wBXHd / KHqkVA77a)
  SUPERVISOR_FORECASTS: '/supervisor/forecasts', // ?department={id} = one department (Framer wY0BB3HcK)
  SUPERVISOR_AUDIT: '/supervisor/audit', // ?entry={id} opens one entry (Framer xqItzoFYK / cm5eFM0vJ)
  SUPERVISOR_REPORTS: '/supervisor/reports', // /supervisor/reports/:id = one report + sign-off (Framer AaD8UZ08p / dcfDyyuKE)
  SUPERVISOR_FLAGGED: '/supervisor/flagged', // /supervisor/flagged/:id = investigate one flag (Framer ESBUdF0jl / lFqUUsfzi)
  SUPERVISOR_HELP: '/supervisor/help', // /supervisor/help/:slug = one guide (Framer cR3NPU8IK / mZNmzhDdX, 2026-11-27)
  SUPERVISOR_NOTIFICATIONS: '/supervisor/notifications',
  SUPERVISOR_PROFILE: '/supervisor/profile',
  SUPERVISOR_CHANGE_PASSWORD: '/supervisor/change-password',
  FORBIDDEN: '/403',
  STATUS: '/status',
})

// The account menu pages for each role that has them (My profile, Account settings, Change password,
// My activity, Help & support). Used by the account menus and by the pages' own tab row.
export const ACCOUNT_PATHS = Object.freeze({
  [ROLES.ADMIN]: Object.freeze({
    profile: PATHS.ADMIN_PROFILE,
    settings: PATHS.ADMIN_SETTINGS,
    changePassword: PATHS.ADMIN_CHANGE_PASSWORD,
    activity: PATHS.ADMIN_ACTIVITY,
    help: PATHS.ADMIN_HELP,
  }),
  // Clerks (2026-11-22): the pages that apply to them, plus notifications and the approval guide
  [ROLES.CLERK]: Object.freeze({
    profile: PATHS.CLERK_PROFILE,
    changePassword: PATHS.CLERK_CHANGE_PASSWORD,
    notifications: PATHS.CLERK_NOTIFICATIONS,
    approvalGuide: PATHS.CLERK_APPROVAL_GUIDE,
  }),
  // Accounting Officers (2026-11-26): the same account pages as clerks, plus notifications and (2026-11-27) Help & guides
  [ROLES.OFFICER]: Object.freeze({
    profile: PATHS.OFFICER_PROFILE,
    changePassword: PATHS.OFFICER_CHANGE_PASSWORD,
    notifications: PATHS.OFFICER_NOTIFICATIONS,
    help: PATHS.OFFICER_HELP,
  }),
  // Supervisors / Managers (2026-11-27): profile, password, notifications and Help & guides
  [ROLES.SUPERVISOR]: Object.freeze({
    profile: PATHS.SUPERVISOR_PROFILE,
    changePassword: PATHS.SUPERVISOR_CHANGE_PASSWORD,
    notifications: PATHS.SUPERVISOR_NOTIFICATIONS,
    help: PATHS.SUPERVISOR_HELP,
  }),
  [ROLES.SUPER_ADMIN]: Object.freeze({
    profile: PATHS.SUPERADMIN_PROFILE,
    settings: PATHS.SUPERADMIN_ACCOUNT,
    changePassword: PATHS.SUPERADMIN_CHANGE_PASSWORD,
    activity: PATHS.SUPERADMIN_ACTIVITY,
    help: PATHS.SUPERADMIN_HELP,
  }),
})

// Each role's own landing page. Only that role may open it (see app/router.jsx).
export const ROLE_HOME = Object.freeze({
  [ROLES.SUPER_ADMIN]: PATHS.SUPERADMIN,
  [ROLES.ADMIN]: PATHS.ADMIN,
  [ROLES.CLERK]: PATHS.CLERK,
  [ROLES.OFFICER]: PATHS.OFFICER,
  [ROLES.SUPERVISOR]: PATHS.SUPERVISOR,
})
