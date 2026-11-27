import { apiClient, BACKGROUND } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/** Financial reports of the company in the switcher (Accounting Officer, 2026-11-27). Money arrives as text. */

/** List + meta { stats, ai: { configured, model, paused }, departments, current_page, last_page, total } */
export async function listReports({ type, department, search, page = 1, signal } = {}) {
  const params = { page }
  if (type) params.type = type
  if (department) params.department = department
  if (search) params.search = search
  const { data } = await apiClient.get('/officer/reports', { params, signal })
  return { reports: data.data, meta: data.meta }
}

/** One report with its frozen figures and AI summary. `background` = a polling refresh (not activity). */
export async function getReport(id, { background = false, signal } = {}) {
  const { data } = await apiClient.get(`/officer/reports/${id}`, { ...(background ? BACKGROUND : {}), signal })
  return data.data
}

/** What the dialog would include: { title, range, vouchers, total }. 422 = the period isn't valid. */
export async function previewReport(values, { signal } = {}) {
  const { data } = await apiClient.get('/officer/reports/preview', { params: values, signal })
  return data.data
}

/** Generate: { type, period | from+to, department_id?, includes: { summary, breakdown, flagged, forecast } } → 201 */
export async function generateReport(values) {
  const { data } = await apiClient.post('/officer/reports', values)
  return data.data
}

/** Write the AI summary again (Regenerate / Retry). 409 SUMMARY_IN_PROGRESS while one is being written. */
export async function rewriteSummary(id) {
  const { data } = await apiClient.post(`/officer/reports/${id}/summary`)
  return data.data
}

export async function downloadReport(id, format) {
  const response = await apiClient.get(`/officer/reports/${id}/${format}`, { responseType: 'blob', validateStatus: () => true })
  return saveDownload(response, `report.${format}`)
}
