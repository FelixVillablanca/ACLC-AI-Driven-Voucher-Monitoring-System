import { z } from 'zod'

/**
 * Browser-side rules for "Create admin account" (instant feedback).
 * The backend (StoreAdminRequest.php) checks again, including "this email is already taken".
 * Not in the form: the Employee ID and the @Administrator.com domain (both set by the server),
 * and no password: the new Admin chooses it from the link sent to their personal email.
 */
export const createAdminSchema = z.object({
  first_name: z.string().trim().min(1, 'Enter the first name.').max(100),
  last_name: z.string().trim().min(1, 'Enter the last name.').max(100),
  email_username: z
    .string()
    .trim()
    .min(1, 'Enter the email name (the part before @).')
    .max(64, 'The email name can be at most 64 characters.')
    .regex(/^[a-z0-9]+([._-][a-z0-9]+)*$/i, 'Use only letters, numbers and . _ - (no spaces or @).'),
  company_id: z.coerce.number({ error: 'Choose the company this Admin will run.' }).int().positive('Choose the company this Admin will run.'),
  personal_email: z
    .string()
    .trim()
    .min(1, 'Enter their personal email. The set-password link is sent there.')
    .max(255)
    .pipe(z.email('Enter a valid email address, like name@gmail.com.')),
})
