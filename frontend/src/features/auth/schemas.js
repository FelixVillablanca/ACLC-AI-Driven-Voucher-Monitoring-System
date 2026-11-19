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

/** "Set your password" page (invitation link). Same rule as the server: 12+ characters, letters AND numbers. */
export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .regex(/[A-Za-z]/, 'Use both letters and numbers.')
      .regex(/[0-9]/, 'Use both letters and numbers.'),
    password_confirmation: z.string().min(1, 'Type the password again.'),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The two passwords don’t match.',
  })
