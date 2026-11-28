import { useEffect, useState } from 'react'
import { Building2, ChevronDown, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { normalizeApiError } from '@/lib/apiError'
import { formatDate, formatTimeLeft, plural } from '@/lib/formatters'
import { assignAdminCompany, listCompaniesWithoutAdmin } from '../api'
import { announceAdminsChanged } from '../utils'

/**
 * Admins tab "Assign to a company" (user request 2026-11-28), for an Admin with no company yet: pick one of the
 * companies nobody (active) runs, and they become its Admin. Stops their 24-hour removal countdown.
 * account: { id, full_name, company_deadline }
 */
export default function AssignCompanyDialog({ account, onCancel, onDone }) {
  const [options, setOptions] = useState({ status: 'loading', companies: [], error: null })
  const [companyId, setCompanyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listCompaniesWithoutAdmin()
      .then((companies) => {
        if (cancelled) return
        setOptions({ status: 'ready', companies, error: null })
        setCompanyId((id) => (companies.some((c) => String(c.id) === id) ? id : companies.length === 1 ? String(companies[0].id) : ''))
      })
      .catch((err) => !cancelled && setOptions({ status: 'error', companies: [], error: normalizeApiError(err) }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const company = options.companies.find((c) => String(c.id) === companyId)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await assignAdminCompany(account.id, companyId)
      announceAdminsChanged()
      onDone(`${account.full_name} now runs ${company?.name ?? 'the company'}. They got a notice.`)
    } catch (err) {
      setBusy(false)
      setError(err.errors?.company_id ? { ...err, message: err.errors.company_id[0] } : err)
      setAttempt((n) => n + 1) // the list may have changed
    }
  }

  return (
    <ConfirmDialog
      title={`Assign ${account.full_name} to a company`}
      description="They become the System Administrator of the company you choose."
      icon={{ icon: Building2, tone: 'primary' }}
      confirmLabel="Make them its Admin"
      confirmDisabled={!companyId || options.status !== 'ready'}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onCancel}
      extraAction={options.status === 'error' ? { label: 'Try again', onClick: () => setAttempt((n) => n + 1) } : null}
    >
      {options.status === 'loading' && (
        <p role="status" className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading companies without an Admin…
        </p>
      )}

      {options.status === 'error' && <p className="text-danger">Couldn’t load the companies: {options.error.message}</p>}

      {options.status === 'ready' && options.companies.length === 0 && (
        <p>
          Every active company already has an Admin. Add a new company (Companies tab → + Add company) and choose {account.full_name} as its
          Admin there.
        </p>
      )}

      {options.status === 'ready' && options.companies.length > 0 && (
        <FieldShell
          id="assign-company"
          label="Company"
          required
          hint={
            company
              ? `${plural(company.users_count, 'user', 'users')} · nobody runs it yet`
              : 'Only active companies with no Admin are listed.'
          }
        >
          <div className="relative">
            <select
              id="assign-company"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={busy}
              className={`${inputClass} appearance-none pr-9`}
            >
              <option value="">Choose a company</option>
              {options.companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </FieldShell>
      )}

      {account.company_deadline && (
        <p className="text-caption">
          Without a company this account is removed {formatTimeLeft(account.company_deadline)} (
          {formatDate(account.company_deadline, 'MMM d, h:mm a')}). Assigning one stops that.
        </p>
      )}
    </ConfirmDialog>
  )
}
