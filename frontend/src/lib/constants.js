// Values that never change, kept in ONE place so a typo can't sneak in.

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CLERK: 'accounting_clerk',
  OFFICER: 'accounting_officer',
  SUPERVISOR: 'supervisor_manager',
})

// Short role names for badges/pills (Framer user menu: "Admin")
export const ROLE_SHORT_LABELS = Object.freeze({
  admin: 'Admin',
  accounting_clerk: 'Clerk',
  accounting_officer: 'Officer',
  supervisor_manager: 'Supervisor',
})

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.CLERK]: 'Accounting Clerk',
  [ROLES.OFFICER]: 'Accounting Officer',
  [ROLES.SUPERVISOR]: 'Supervisor / Manager',
})

// Each role's own email domain (CLAUDE.md "Domain emails"). The backend uses the same list
// (app/Domain/Identity/Support/RoleEmailDomains.php) and builds the real address itself.
export const ROLE_EMAIL_DOMAINS = Object.freeze({
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
  ADMIN: '/admin',
  ADMIN_COMPANIES: '/admin/companies',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_USERS: '/admin/users',
  ADMIN_COMPANY_ACCESS: '/admin/company-access',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_AUDIT_LOGS: '/admin/audit-logs',
  ADMIN_PROFILE: '/admin/profile',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_CHANGE_PASSWORD: '/admin/change-password',
  ADMIN_HELP: '/admin/help',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  CLERK: '/clerk',
  OFFICER: '/officer',
  SUPERVISOR: '/supervisor',
  FORBIDDEN: '/403',
  STATUS: '/status',
})

// Each role's own landing page. Only that role may open it (see app/router.jsx).
export const ROLE_HOME = Object.freeze({
  [ROLES.ADMIN]: PATHS.ADMIN,
  [ROLES.CLERK]: PATHS.CLERK,
  [ROLES.OFFICER]: PATHS.OFFICER,
  [ROLES.SUPERVISOR]: PATHS.SUPERVISOR,
})
