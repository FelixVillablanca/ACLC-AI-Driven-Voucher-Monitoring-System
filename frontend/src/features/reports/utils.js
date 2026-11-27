import { PATHS } from '@/lib/constants'

export const reportPath = (id) => `${PATHS.OFFICER_REPORTS}/${id}`

export const TYPE_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', custom: 'Department' }

/** The AI summary column / box: tone + label per summary_status. */
export const SUMMARY_STATUS = {
  ready: { tone: 'primary', label: '✦ Ready' },
  queued: { tone: 'neutral', label: '⟳ Waiting…' },
  writing: { tone: 'neutral', label: '⟳ Writing…' },
  failed: { tone: 'danger', label: '⚠ Failed · retry' },
  paused: { tone: 'warning', label: 'Paused · spend cap' },
  not_set_up: { tone: 'neutral', label: 'Not set up' },
  off: { tone: 'neutral', label: 'Not asked for' },
}

/** The months that can be reported (current month first, back 24 months): [{ value: '2026-11', label: 'November 2026' }] */
export function monthChoices(now = new Date()) {
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { value, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + (i === 0 ? ' (so far)' : '') }
  })
}

/** Quarters (current first, back 8): [{ value: '2026-Q4', label: 'Q4 2026' }] */
export function quarterChoices(now = new Date()) {
  const q = Math.floor(now.getMonth() / 3)
  return Array.from({ length: 8 }, (_, i) => {
    const idx = q - i
    const year = now.getFullYear() + Math.floor(idx / 4)
    const quarter = (((idx % 4) + 4) % 4) + 1
    return { value: `${year}-Q${quarter}`, label: `Q${quarter} ${year}${i === 0 ? ' (so far)' : ''}` }
  })
}

/** Whole-number change pill text: "▲ 12%" / "▼ 3%" */
export const changeText = (pct) => (pct == null ? null : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`)

/** The Supervisor's sign-off of a report (2026-11-27): tone + short label per signoff.status. */
export const SIGNOFF_STATUS = {
  pending: { tone: 'warning', label: 'Waiting for sign-off' },
  signed: { tone: 'success', label: 'Signed off' },
  returned: { tone: 'danger', label: 'Sent back' },
  not_needed: { tone: 'neutral', label: 'No sign-off needed' },
}
