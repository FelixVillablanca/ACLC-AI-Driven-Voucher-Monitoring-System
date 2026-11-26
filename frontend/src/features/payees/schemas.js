import { z } from 'zod'

/** Add / edit payee (Framer UKm7GrwEZ). The server checks the same things plus "already exists". */
export const payeeSchema = z.object({
  name: z.string().trim().min(1, 'Enter the payee’s name.').max(255),
  payee_type_id: z.coerce.number({ error: 'Choose a payee type.' }).int().positive('Choose a payee type.'),
  tin: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === '' || (/^[0-9 -]+$/.test(v) && [9, 12].includes(v.replace(/\D/g, '').length)), {
      message: 'Enter the TIN as 9 or 12 digits, e.g. 000-101-528-000.',
    }),
  default_payment_method: z.union([z.literal(''), z.enum(['cash', 'bank', 'cheque'])]),
  bank_name: z.string().trim().max(150),
  bank_account_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[0-9 -]*$/, 'Use numbers, spaces and dashes only.'),
  bank_account_name: z.string().trim().max(150),
  address: z.string().trim().max(500),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address, e.g. billing@company.ph.').max(255)]),
})

export function payeeFormValues(payee, prefillName = '') {
  const s = (v) => (v === null || v === undefined ? '' : String(v))
  return {
    name: payee ? payee.name : prefillName,
    payee_type_id: payee?.type?.id ?? '',
    tin: s(payee?.tin),
    default_payment_method: payee?.default_payment_method ?? '',
    bank_name: s(payee?.bank_name),
    bank_account_number: s(payee?.bank_account_number),
    bank_account_name: s(payee?.bank_account_name),
    address: s(payee?.address),
    email: s(payee?.email),
  }
}

/** Empty text → null; bank details only for bank transfers (the server clears them too). */
export function toPayeePayload(values) {
  const n = (v) => (v === '' ? null : v)
  const bank = values.default_payment_method === 'bank'
  return {
    name: values.name,
    payee_type_id: values.payee_type_id,
    tin: n(values.tin),
    default_payment_method: n(values.default_payment_method),
    bank_name: bank ? n(values.bank_name) : null,
    bank_account_number: bank ? n(values.bank_account_number) : null,
    bank_account_name: bank ? n(values.bank_account_name) : null,
    address: n(values.address),
    email: n(values.email),
  }
}
