import { format, isToday } from 'date-fns'

/** Opens "Retry failed jobs" on top of ANY Super Admin page. */
export const RETRY_JOBS_PARAM = 'retry'
export const RETRY_JOBS_VALUE = 'jobs'
export const RETRY_JOBS_SEARCH = `?${RETRY_JOBS_PARAM}=${RETRY_JOBS_VALUE}`

/** Fired after jobs are retried or deleted, so the dashboard's "jobs failed" row refreshes. */
export const JOBS_CHANGED_EVENT = 'advms:jobs-changed'

export function announceJobsChanged() {
  window.dispatchEvent(new CustomEvent(JOBS_CHANGED_EVENT))
}

/** "Failed 08:15" today, "Failed Nov 19, 08:15" before that; plus the allowed tries. */
export function failedLine(job) {
  const date = new Date(job.failed_at)
  const when = `Failed ${isToday(date) ? format(date, 'HH:mm') : format(date, 'MMM d, HH:mm')}`
  return job.max_tries ? `${when} · ${job.max_tries === 1 ? '1 try allowed' : `tried ${job.max_tries}×`}` : when
}

/**
 * The status box for a service the jobs depend on (Framer: "ML service status: Operational now").
 * tone: amber box when it's working (retrying should help), red when it's down (retrying would fail again).
 */
export function serviceStatus(key, status) {
  const name = { ml: 'ML service' }[key] ?? key
  if (status === 'ok') {
    return {
      tone: 'warning',
      title: `${name} status: Operational now`,
      caption: 'If it goes down again, these vouchers keep the “AI check pending” label and officers can still review them.',
    }
  }
  return {
    tone: 'danger',
    title: `${name} status: Not answering`,
    caption: 'Retrying now will probably fail again. Wait until it’s back up.',
  }
}
