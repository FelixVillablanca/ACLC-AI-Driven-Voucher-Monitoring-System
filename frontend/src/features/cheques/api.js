import { apiClient } from '@/lib/apiClient'

/**
 * Cheque register (2026-11-29). The company comes from X-Company-ID (apiClient adds it).
 * Clerks see and move the cheques of their own vouchers; officers and supervisors read the company's register.
 */

/** GET /cheques?view=&search=&sort=&page=  → { data, meta: { counts, outstanding_total, cleared_total, stale_soon, … } } */
export async function listCheques(params, { signal } = {}) {
  const { data } = await apiClient.get('/cheques', { params, signal })
  return data
}

/** Every cheque of one of the clerk's vouchers, newest first. */
export async function getVoucherCheques(voucherId, { signal } = {}) {
  const { data } = await apiClient.get(`/vouchers/${voucherId}/cheques`, { signal })
  return data.data
}

/** { cheque_number, cheque_date: 'YYYY-MM-DD', bank_name } */
export async function recordCheque(voucherId, body) {
  const { data } = await apiClient.post(`/vouchers/${voucherId}/cheques`, body)
  return data.data
}

/** step = 'release' { received_by } | 'clear' { cleared_on } | 'cancel' { reason } */
export async function moveCheque(chequeId, step, body) {
  const { data } = await apiClient.post(`/cheques/${chequeId}/${step}`, body)
  return data.data
}
