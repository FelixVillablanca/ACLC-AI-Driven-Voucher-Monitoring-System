import { z } from 'zod'

/** companies.type, in the order the form lists them (labels: TYPE_LABELS in utils.js). */
export const COMPANY_TYPES = ['corporate', 'school', 'government', 'ngo', 'other']

const optional = (schema) => z.union([z.literal(''), schema]).optional()

/**
 * Browser-side rules for "+ Add company" (instant feedback).
 * The backend (StoreCompanyRequest.php) checks again, including "this name already exists".
 */
export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'Enter the company name.').max(150, 'Use at most 150 characters.'),
  type: z.enum(COMPANY_TYPES, { error: 'Choose what kind of organisation it is.' }),
  address: z.string().trim().max(500, 'Use at most 500 characters.').optional(),
  contact_email: optional(z.string().trim().max(255).pipe(z.email('Enter a valid email address.'))),
  contact_phone: optional(
    z
      .string()
      .trim()
      .max(20, 'Use at most 20 characters.')
      .regex(/^[0-9+()\-\s]+$/, 'Use numbers, spaces, +, - and brackets only.'),
  ),
  tin_number: optional(
    z
      .string()
      .trim()
      .max(50)
      .regex(/^[0-9\-\s]+$/, 'Use numbers and dashes only (e.g. 123-456-789-000).'),
  ),
  fiscal_year_start: z.string().optional(),
})
