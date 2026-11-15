import { z } from 'zod'

/**
 * ZOD SCHEMA = the rules a form must pass BEFORE it is sent.
 * It gives instant feedback in the browser. The backend checks again
 * (LoginRequest.php), because browser checks can be bypassed.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your work email.')
    .pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean(),
})
