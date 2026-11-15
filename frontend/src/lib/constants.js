// Values that never change, kept in ONE place so a typo can't sneak in.

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CLERK: 'accounting_clerk',
  OFFICER: 'accounting_officer',
  SUPERVISOR: 'supervisor_manager',
})

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.CLERK]: 'Accounting Clerk',
  [ROLES.OFFICER]: 'Accounting Officer',
  [ROLES.SUPERVISOR]: 'Supervisor / Manager',
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
  APP: '/app',
  FORBIDDEN: '/403',
  STATUS: '/status',
})
