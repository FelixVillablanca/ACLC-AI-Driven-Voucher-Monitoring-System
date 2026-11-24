import { z } from 'zod'

const money2 = /^\d+(\.\d{1,2})?$/ // 12, 12.5, 12.50 (no more than 2 decimals)

/**
 * Browser-side rules for the voucher form (instant feedback). A DRAFT may be incomplete: only the
 * category and payment method are needed. What a reviewer needs is checked by the server on Submit
 * (its 422 errors land under the same fields). The server also adds up the total itself.
 */
export const voucherSchema = z.object({
  category_id: z.coerce.number({ error: 'Choose a category.' }).int().positive('Choose a category.'),
  payment_method: z.enum(['cash', 'bank', 'cheque'], { error: 'Choose how it will be paid.' }),
  payee_name: z.string().trim().max(255),
  payee_type_id: z.union([z.literal(''), z.coerce.number().int().positive()]),
  voucher_type_id: z.union([z.literal(''), z.coerce.number().int().positive()]),
  department_id: z.union([z.literal(''), z.coerce.number().int().positive()]),
  description: z.string().trim().max(2000, 'Use at most 2,000 characters.'),
  purpose: z.string().trim().max(2000, 'Use at most 2,000 characters.'),
  reference_number: z.string().trim().max(100),
  due_date: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  bank_name: z.string().trim().max(150),
  bank_account_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9 -]*$/, 'Use numbers, spaces and dashes only.'),
  bank_account_name: z.string().trim().max(150),
  line_items: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'Describe this line.').max(255),
        quantity: z
          .string()
          .trim()
          .regex(money2, 'A number with up to 2 decimals.')
          .refine((v) => Number(v) > 0, 'More than 0.'),
        unit: z.string().trim().max(30),
        unit_price: z.string().trim().regex(money2, 'An amount like 1250.50'),
      }),
    )
    .max(50, 'A voucher can have at most 50 lines.'),
})

export const EMPTY_LINE = { description: '', quantity: '1', unit: '', unit_price: '' }

/** The form's values from a saved voucher (or empty for a new one). */
export function formValues(voucher, myDepartmentId) {
  const s = (v) => (v === null || v === undefined ? '' : String(v))
  return {
    category_id: voucher?.category?.id ?? '',
    payment_method: voucher?.payment_method ?? 'cash',
    payee_name: s(voucher?.payee_name),
    payee_type_id: voucher?.payee_type_id ?? '',
    voucher_type_id: voucher?.voucher_type_id ?? '',
    department_id: voucher ? (voucher.department_id ?? '') : (myDepartmentId ?? ''),
    description: s(voucher?.description),
    purpose: s(voucher?.purpose),
    reference_number: s(voucher?.reference_number),
    due_date: s(voucher?.due_date).slice(0, 10),
    priority: voucher?.priority ?? 'normal',
    bank_name: s(voucher?.bank_name),
    bank_account_number: s(voucher?.bank_account_number),
    bank_account_name: s(voucher?.bank_account_name),
    line_items: voucher?.line_items?.length
      ? voucher.line_items.map((l) => ({
          description: l.description ?? '',
          quantity: String(Number(l.quantity)),
          unit: l.unit ?? '',
          unit_price: l.unit_price,
        }))
      : [{ ...EMPTY_LINE }],
  }
}

/** What's sent to the server: empty choices become null, numbers stay text (exact decimals). */
export function toPayload(values) {
  const n = (v) => (v === '' || v === null ? null : v)
  return {
    ...values,
    payee_name: n(values.payee_name),
    payee_type_id: n(values.payee_type_id),
    voucher_type_id: n(values.voucher_type_id),
    department_id: n(values.department_id),
    description: n(values.description),
    purpose: n(values.purpose),
    reference_number: n(values.reference_number),
    due_date: n(values.due_date),
    bank_name: n(values.bank_name),
    bank_account_number: n(values.bank_account_number),
    bank_account_name: n(values.bank_account_name),
    line_items: values.line_items.map((l) => ({ ...l, unit: n(l.unit) })),
  }
}
