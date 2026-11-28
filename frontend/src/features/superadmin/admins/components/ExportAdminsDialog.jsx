import { useState } from 'react'
import { Check, ChevronDown, Download, FileSpreadsheet, FileText, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { exportAdmins } from '../api'

const COLUMNS = [
  { key: 'name', label: 'Name and email', on: true },
  { key: 'role_status', label: 'Role and status', on: true },
  { key: 'two_factor', label: 'Two-step sign-in', on: true },
  { key: 'dates', label: 'Last sign-in and created', on: true },
  { key: 'employee_id', label: 'Employee ID', on: false },
  { key: 'company', label: 'Company', on: false },
]

const FORMATS = [
  { key: 'csv', label: 'CSV', hint: 'Opens in Excel or Google Sheets', icon: FileSpreadsheet },
  { key: 'pdf', label: 'PDF', hint: 'For printing or sharing', icon: FileText },
]

/**
 * "Export admin list" (A1, frame tzF153Wh1): format, which accounts, what to include.
 *   counts: { all, view, selected }   filters: { view, search }   selectedIds: [ids]
 */
export default function ExportAdminsDialog({ counts, filters, selectedIds, onCancel, onDone }) {
  const [format, setFormat] = useState('csv')
  const [accounts, setAccounts] = useState(selectedIds.length ? 'selected' : 'all')
  const [columns, setColumns] = useState(COLUMNS.filter((c) => c.on).map((c) => c.key))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const count = counts[accounts] ?? 0
  const filtered = Boolean(filters.view || filters.search)

  const toggle = (key) => setColumns((cols) => (cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]))

  const confirm = async () => {
    if (columns.length === 0) return setError({ message: 'Tick at least one thing to include.' })
    setBusy(true)
    setError(null)
    try {
      const file = await exportAdmins({
        format,
        accounts,
        view: accounts === 'view' ? filters.view : undefined,
        search: accounts === 'view' ? filters.search : undefined,
        ids: accounts === 'selected' ? selectedIds : undefined,
        columns: COLUMNS.map((c) => c.key).filter((k) => columns.includes(k)), // keep the table's column order
      })
      toast.success(`${file} downloaded`)
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title="Export admin list"
      confirmLabel={
        <>
          <Download className="size-4" aria-hidden="true" /> Export {plural(count, 'account', 'accounts')}
        </>
      }
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
      confirmDisabled={count === 0}
      width={520}
    >
      <p>A file of the Super Admin and Admin accounts you choose.</p>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-label mb-1.5 text-foreground">Format</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <label
              key={f.key}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2.5',
                format === f.key ? 'border-primary bg-primary-faint' : 'bg-card hover:bg-muted',
              )}
            >
              <input
                type="radio"
                name="export-format"
                value={f.key}
                checked={format === f.key}
                onChange={() => setFormat(f.key)}
                className="sr-only"
              />
              <f.icon className={cn('size-5 shrink-0', format === f.key ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
              <span>
                <span className="text-body-strong block text-foreground">{f.label}</span>
                <span className="text-caption">{f.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="export-accounts" className="text-label text-foreground">
          Which accounts
        </label>
        <div className="relative">
          <select
            id="export-accounts"
            value={accounts}
            onChange={(e) => setAccounts(e.target.value)}
            className={cn(inputClass, 'appearance-none pr-8')}
          >
            <option value="all">All {plural(counts.all, 'account', 'accounts')}</option>
            {filtered && <option value="view">This view ({plural(counts.view, 'account', 'accounts')})</option>}
            {selectedIds.length > 0 && <option value="selected">Selected ({plural(counts.selected, 'account', 'accounts')})</option>}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-label mb-1.5 text-foreground">Include</legend>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
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

      <p className="text-caption flex items-center gap-1.5">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" />
        Passwords are never exported. This export is recorded in the audit log.
      </p>
    </ConfirmDialog>
  )
}
