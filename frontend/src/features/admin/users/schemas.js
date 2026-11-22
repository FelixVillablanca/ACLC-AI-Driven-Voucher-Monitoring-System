import { z } from 'zod'

/**
 * Browser-side rules for the Create user form (instant feedback).
 * The backend (StoreUserRequest.php) checks again, including things only it
 * can know, like "this email is already taken".
 *
 * Not in the form on purpose:
 *   - Employee ID: the server assigns it (EMP-2026-0001…)
 *   - the email DOMAIN: the server adds it from the role (@Clerk.com…)
 *   - department is OPTIONAL (companies may have none yet)
 *   - the Admin role: only a Super Admin creates Admin accounts (spec §4.5, 2026-11-20)
 *   - the company and company access (2026-11-22): the user always joins the Admin's own company
 */
export const createUserSchema = z.object({
  first_name: z.string().trim().min(1, 'Enter the first name.').max(100),
  last_name: z.string().trim().min(1, 'Enter the last name.').max(100),
  // Only the name part before "@"; the domain comes from the role (see EmailNameField)
  email_username: z
    .string()
    .trim()
    .min(1, 'Enter the email name (the part before @).')
    .max(64, 'The email name can be at most 64 characters.')
    .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/i, 'Use only letters, numbers and . _ - (no spaces or @).'),
  password: z
    .string()
    .min(12, 'Generate a password.')
    .regex(/[A-Za-z]/, 'The password must contain letters.')
    .regex(/[0-9]/, 'The password must contain numbers.'),
  role: z.enum(['accounting_clerk', 'accounting_officer', 'supervisor_manager'], { error: 'Choose a role.' }),
  department_id: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
})

export const ROLE_OPTIONS = [
  { value: 'accounting_clerk', label: 'Accounting Clerk', description: 'Creates and submits vouchers.' },
  { value: 'accounting_officer', label: 'Accounting Officer', description: 'Level 1 review and budgets.' },
  { value: 'supervisor_manager', label: 'Supervisor / Manager', description: 'Level 2 final approval.' },
]
