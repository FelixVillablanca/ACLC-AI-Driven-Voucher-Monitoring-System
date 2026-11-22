import { z } from 'zod'

/** Browser-side rules for "Add department". The server (StoreDepartmentRequest) checks again, incl. "already used". */
export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, 'Enter the department name.').max(150, 'Use at most 150 characters.'),
  code: z
    .string()
    .trim()
    .min(1, 'Enter a short code, e.g. FIN.')
    .max(20, 'The code can be at most 20 characters.')
    .regex(/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/, 'Use letters and numbers, with - between parts (e.g. FIN or HR-OPS).'),
  description: z.string().trim().max(500, 'Use at most 500 characters.').optional(),
  head_user_id: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
})
