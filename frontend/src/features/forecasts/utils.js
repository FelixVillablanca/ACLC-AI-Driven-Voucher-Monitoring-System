import { PATHS } from '@/lib/constants'

/** Fired after "Recalculate": open forecast pages reload. */
export const FORECASTS_CHANGED_EVENT = 'forecasts:changed'

export const announceForecastsChanged = () => window.dispatchEvent(new Event(FORECASTS_CHANGED_EVENT))

export const MONTH_CHOICES = [1, 2, 3]

export const forecastPath = (departmentId, months) =>
  `${PATHS.OFFICER_FORECASTS}/${departmentId}${months && months !== 3 ? `?months=${months}` : ''}`

/** Risk pill: tone + text, e.g. { tone: 'danger', text: 'Over by ₱84k' } */
export const RISK = {
  over: { tone: 'danger', label: 'Over budget' },
  tight: { tone: 'warning', label: 'Tight' },
  on_track: { tone: 'success', label: 'On track' },
  no_budget: { tone: 'neutral', label: 'No budget set' },
  no_forecast: { tone: 'neutral', label: 'Not enough history' },
}

/** "Next 3 months (Dec – Feb)" */
export function windowLabel(window, months) {
  if (!window?.months?.length) return months === 1 ? 'Next month' : `Next ${months} months`
  const m = window.months
  return m.length === 1 ? `${m[0]} forecast` : `Next ${m.length} months (${m[0]} – ${m.at(-1)})`
}
