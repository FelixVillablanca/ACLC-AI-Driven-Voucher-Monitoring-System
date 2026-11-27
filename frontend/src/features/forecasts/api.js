import { apiClient } from '@/lib/apiClient'
import { saveDownload } from '@/lib/download'

/**
 * The Accounting Officer's spending forecasts (2026-11-27). Company = the one in the switcher.
 * `months` = how many months after this one to look at (1–3). The server works out this month's
 * forecasts on the first visit of a month.
 */

/** Overview (Framer GWmqqOmd7): { chart, next_month, rows, accuracy, months_used, r_squared, generated_at, … } */
export async function getForecasts(months, { signal } = {}) {
  const { data } = await apiClient.get('/officer/forecasts', { params: { months }, signal })
  return data.data
}

/** One department (Framer sjtX1kKqt): forecast, risk vs budget, chart, drivers, recommendation, budget. */
export async function getDepartmentForecast(departmentId, months, { signal } = {}) {
  const { data } = await apiClient.get(`/officer/forecasts/departments/${departmentId}`, { params: { months }, signal })
  return data.data
}

/** Work the forecasts out again now (e.g. after many approvals this month). */
export async function recalculateForecasts() {
  const { data } = await apiClient.post('/officer/forecasts/recalculate')
  return data.data
}

/** Downloads the overview table as CSV or Excel; returns the file name. */
export async function exportForecast(months, format = 'csv') {
  const response = await apiClient.get('/officer/forecasts/export', {
    params: { months, format },
    responseType: 'blob',
    validateStatus: () => true,
  })
  return saveDownload(response, `forecast.${format}`)
}
