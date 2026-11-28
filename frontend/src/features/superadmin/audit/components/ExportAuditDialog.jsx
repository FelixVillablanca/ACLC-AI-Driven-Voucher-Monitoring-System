import { useState } from 'react'
import { addDays, format } from 'date-fns'
import { AlertTriangle, Download } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { exportAuditLog } from '../api'
import { rangeLabel } from '../utils'
import CheckBox from './CheckBox'

const iso = (d) => format(d, 'yyyy-MM-dd')

/** About how big one exported row is (for the "about 240 KB" estimate). */
const BYTES_PER_ROW = 190

/**
 * "Export audit log" (AL1, frame EJ0asP2ZH's dialog, 520px): date range, which events
 * (all / sensitive only / match the page's filters), extra columns, the personal-data warning,
 * and an estimate of the file size. The export itself is written to the audit log.
 *   filters: the page's filters   counts: { all, sensitive, filters } for the page's range (today by default)
 */
export default function ExportAuditDialog({ filters, counts, onCancel, onDone }) {
  const ranges = [
    { key: 'today', label: 'Today', from: iso(new Date()), to: null },
    { key: '7d', label: 'Last 7 days', from: iso(addDays(new Date(), -7)), to: null },
    { key: '30d', label: 'Last 30 days', from: iso(addDays(new Date(), -30)), to: null },
    { key: 'page', label: `As on the page (${rangeLabel(filters)})`, from: filters.from, to: filters.to },
  ]
  const [range, setRange] = useState('page')
  const [events, setEvents] = useState('all')
  const [include, setInclude] = useState(['values'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const chosen = ranges.find((r) => r.key === range)
  // The counts are known for the page's range only; for another range the server counts on export.
  const known = range === 'page' ? counts[events] : null

  const toggle = (key, on) => setInclude((list) => (on ? [...list, key] : list.filter((k) => k !== key)))

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const file = await exportAuditLog({ from: chosen.from, to: chosen.to, events, include, filters })
      onDone(`${file} downloaded`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title="Export audit log"
      description="Download events as a CSV file for auditors or your own records."
      confirmLabel={
        <>
          <Download className="size-4" aria-hidden="true" /> Export CSV
        </>
      }
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
      confirmDisabled={known === 0}
      width={520}
    >
      <fieldset>
        <legend className="text-label mb-1.5 text-foreground">Date range</legend>
        <div className="flex flex-wrap gap-2">
          {ranges.map((r) => (
            <label
              key={r.key}
              className={cn(
                'flex h-9 cursor-pointer items-center rounded-full border px-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                range === r.key ? 'text-badge border-primary bg-primary-soft text-primary' : 'text-body bg-card hover:bg-muted',
              )}
            >
              <input type="radio" name="export-range" checked={range === r.key} onChange={() => setRange(r.key)} className="sr-only" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-label mb-1.5 text-foreground">Which events</legend>
        {[
          { key: 'all', label: 'All events', hint: range === 'page' ? formatNumber(counts.all) : null },
          { key: 'sensitive', label: '⚑ Sensitive actions only', hint: range === 'page' ? formatNumber(counts.sensitive) : null },
          {
            key: 'filters',
            label: 'Match the filters on the page',
            hint: range === 'page' ? formatNumber(counts.filters) : 'Search, company and action filters',
          },
        ].map((o) => (
          <label
            key={o.key}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border px-3.5 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
              events === o.key ? 'border-primary bg-primary-faint' : 'bg-card hover:bg-muted',
            )}
          >
            <input type="radio" name="export-events" checked={events === o.key} onChange={() => setEvents(o.key)} className="sr-only" />
            <span className={events === o.key ? 'text-body-strong text-foreground' : 'text-body text-foreground'}>{o.label}</span>
            {o.hint && <span className="text-caption">{o.hint}</span>}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label mb-1.5 text-foreground">Also include</legend>
        <CheckBox checked={include.includes('values')} onChange={(v) => toggle('values', v)}>
          <span className="text-body text-foreground">Before and after values</span>
        </CheckBox>
        <CheckBox checked={include.includes('request')} onChange={(v) => toggle('request', v)}>
          <span className="text-body text-foreground">Request ID and browser</span>
        </CheckBox>
      </fieldset>

      <div className="flex items-start gap-2 rounded-[10px] bg-warning-soft px-3.5 py-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-caption text-foreground">
          The file holds names, emails and IP addresses. Keep it somewhere safe. Amounts are never included. This export is also recorded in
          the audit log.
        </p>
      </div>

      <p className="text-caption">
        {known == null
          ? 'The number of rows is counted when you export (at most 50,000 per file).'
          : `${plural(known, 'row', 'rows')} · about ${Math.max(1, Math.round((known * BYTES_PER_ROW) / 1024)).toLocaleString()} KB`}
      </p>
    </ConfirmDialog>
  )
}
