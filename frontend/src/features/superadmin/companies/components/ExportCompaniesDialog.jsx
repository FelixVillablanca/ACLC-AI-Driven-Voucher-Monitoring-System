import { useState } from 'react'
import { Check, ChevronDown, Download } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { exportCompanies } from '../api'

const FORMATS = [
  { key: 'xlsx', label: 'Excel (.xlsx)' },
  { key: 'csv', label: 'CSV' },
  { key: 'pdf', label: 'PDF' },
]

const COLUMNS = [
  { key: 'details', label: 'Name, type, address and status', on: true },
  { key: 'counts', label: 'Department and user counts', on: true },
  { key: 'suspension', label: 'Suspension history', on: false },
]

/**
 * "Export companies" (C1, frame UpMMFLXSI, 500px): file format, which companies, what to include.
 *   summary: { total, active, suspended }   (the summary cards' numbers)
 *   search / searchCount: the search in the box, if any → "Matching “north” (1)"
 *   sort / suspendedFirst: the file keeps the screen's order
 * The file is made on the server and the export is written to the audit log.
 */
export default function ExportCompaniesDialog({ summary, search, searchCount, sort, suspendedFirst, onCancel, onDone }) {
  const [format, setFormat] = useState('xlsx')
  const [which, setWhich] = useState(search ? 'search' : 'all')
  const [columns, setColumns] = useState(COLUMNS.filter((c) => c.on).map((c) => c.key))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const counts = {
    all: summary?.total ?? 0,
    active: summary?.active ?? 0,
    suspended: summary?.suspended ?? 0,
    search: searchCount ?? 0,
  }
  const count = counts[which]

  const toggle = (key) => setColumns((cols) => (cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]))

  const confirm = async () => {
    if (columns.length === 0) return setError({ message: 'Tick at least one thing to include.' })
    setBusy(true)
    setError(null)
    try {
      const file = await exportCompanies({
        format,
        companies: which,
        search,
        columns,
        sort: sort === 'name' ? undefined : sort,
        suspendedFirst,
      })
      onDone(`${file} downloaded`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title="Export companies"
      description="Download the company list. Exports are logged in the audit log."
      confirmLabel={
        <>
          <Download className="size-4" aria-hidden="true" /> Export {plural(count, 'company', 'companies')}
        </>
      }
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
      confirmDisabled={count === 0}
      width={500}
    >
      <fieldset>
        <legend className="text-label mb-1.5 text-foreground">File format</legend>
        <div className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => {
            const on = format === f.key
            return (
              <label
                key={f.key}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                  on ? 'border-primary bg-primary-faint' : 'bg-card hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="company-export-format"
                  value={f.key}
                  checked={on}
                  onChange={() => setFormat(f.key)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    on ? 'border-primary' : 'border-border',
                  )}
                >
                  {on && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className={cn('truncate', on ? 'text-body-strong text-foreground' : 'text-body text-foreground')}>{f.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="company-export-which" className="text-label text-foreground">
          Companies
        </label>
        <div className="relative">
          <select
            id="company-export-which"
            value={which}
            onChange={(e) => setWhich(e.target.value)}
            className={cn(inputClass, 'appearance-none pr-8')}
          >
            <option value="all">All companies ({counts.all})</option>
            <option value="active">Active only ({counts.active})</option>
            <option value="suspended">Suspended only ({counts.suspended})</option>
            {search && (
              <option value="search">
                Matching “{search}” ({counts.search})
              </option>
            )}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-label mb-1.5 text-foreground">Include</legend>
        <div className="flex flex-col gap-2">
          {COLUMNS.map((c) => {
            const on = columns.includes(c.key)
            return (
              <label key={c.key} className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={on} onChange={() => toggle(c.key)} className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="text-body text-foreground">{c.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <p className="text-caption">Counts only: no amounts or vouchers are ever exported.</p>
    </ConfirmDialog>
  )
}
