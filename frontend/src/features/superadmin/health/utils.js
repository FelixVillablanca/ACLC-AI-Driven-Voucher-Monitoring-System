import { Activity, Bot, Clock, Database, HardDriveDownload, Layers } from 'lucide-react'

/** Fired after something on this page changes (resolve, unblock), so it refreshes. */
export const HEALTH_CHANGED_EVENT = 'advms:health-changed'
export const announceHealthChanged = () => window.dispatchEvent(new CustomEvent(HEALTH_CHANGED_EVENT))

/** The 6 service cards, in order (the server sends the same keys). */
export const SERVICES = [
  { key: 'web', label: 'Web app & API', icon: Activity },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'queue', label: 'Background jobs', icon: Layers },
  { key: 'scheduler', label: 'Scheduler', icon: Clock },
  { key: 'ml', label: 'ML service', icon: Bot },
  { key: 'backup', label: 'Backups', icon: HardDriveDownload },
]

export const serviceLabel = (key) => SERVICES.find((s) => s.key === key)?.label ?? key

/** status → pill: ok "Working" · warning "Slow"/"Needs a look" · danger "Down" · not_configured "Not set up" */
export function statusPill(service, status, extra = {}) {
  if (status === 'not_configured') return { tone: 'neutral', text: 'Not set up' }
  if (service === 'backup') {
    if (extra.running) return { tone: 'primary', text: '◌ Backing up' }
    return status === 'ok' ? { tone: 'success', text: '● Up to date' } : { tone: 'danger', text: '● Overdue' }
  }
  if (service === 'scheduler' && status === 'warning') return { tone: 'warning', text: '● Stopped?' }
  if (status === 'ok') return { tone: 'success', text: '● Working' }
  if (status === 'warning')
    return {
      tone: 'warning',
      text: service === 'queue' ? '● Needs a look' : '● Slow',
    }
  return { tone: 'danger', text: '● Not working' }
}

/** The colour of one day in the 30-day strip. */
export const DAY_TONE = {
  ok: 'bg-success',
  slow: 'bg-warning',
  down: 'bg-danger',
  no_data: 'bg-border',
}

/** "180 ms" / "2.4 s" */
export function formatMs(ms) {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`
}

/** The friendly name of a scheduled task (routes/console.php names them). */
export const TASK_LABELS = {
  'nightly-database-backup': 'nightly backup',
  'prune-health-checks': 'health history clean-up',
}
