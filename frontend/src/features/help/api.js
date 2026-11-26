import { apiClient } from '@/lib/apiClient'

/** Who gets a "Contact support" message: { company, admins: [{ name, email }], topics: [{ key, label }] } */
export async function getSupportContacts() {
  const { data } = await apiClient.get('/support/contacts')
  return data.data
}

/**
 * Sends the message to the company's Admin(s): { topic, message, voucherId?, screenshot?: File }.
 * Returns { admins, emailed }. 422 = field errors; 409 NO_SUPPORT_CONTACT = the company has no Admin.
 */
export async function sendSupportMessage({ topic, message, voucherId, screenshot }) {
  const form = new FormData()
  form.append('topic', topic)
  form.append('message', message)
  if (voucherId) form.append('voucher_id', String(voucherId))
  if (screenshot) form.append('screenshot', screenshot)
  const { data } = await apiClient.post('/support/messages', form)
  return data.data
}
