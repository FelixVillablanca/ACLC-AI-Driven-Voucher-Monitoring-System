import { useState } from 'react'
import { Loader2, TriangleAlert, UserCheck, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { assignCompanyAdmin } from '../api'
import { announceCompaniesChanged } from '../utils'
import AdminInChargeField from './AdminInChargeField'

/**
 * Company panel (C8) Overview: "Admin in charge" for a company with no active Admin (user request 2026-11-28).
 * Pick an Admin who has no company yet and confirm; the panel and the list refresh themselves (COMPANIES_CHANGED_EVENT).
 * A suspended company can't be given one (its Admin couldn't sign in). "Create a new Admin" opens Add admin for it.
 */
export default function AssignAdminSection({ company, onCreateAdmin }) {
  const [adminId, setAdminId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // { field?: string, message, requestId? }
  const [reloadKey, setReloadKey] = useState(0)

  if (company.status !== 'active') {
    return (
      <Section>
        <p className="text-caption">Reactivate the company first: an Admin of a suspended company can’t sign in.</p>
      </Section>
    )
  }

  const assign = async () => {
    setBusy(true)
    setError(null)
    try {
      const updated = await assignCompanyAdmin(company.id, adminId)
      toast.success(`${updated.admin?.full_name ?? 'The Admin'} now runs ${company.name}. They got a notice.`)
      announceCompaniesChanged() // the panel and the Companies list reload quietly
    } catch (err) {
      setBusy(false)
      setReloadKey((n) => n + 1) // the list may have changed (someone else assigned them)
      setError({ field: err.errors?.admin_id?.[0], message: err.message, requestId: err.requestId })
    }
  }

  return (
    <Section>
      <p className="text-caption">
        {company.admin
          ? `${company.admin.full_name} is deactivated, so nobody runs ${company.name} right now. Give it an Admin who has no company yet.`
          : `Nobody runs ${company.name} yet. Give it an Admin who has no company yet; they get a notice and can start setting it up.`}
      </p>

      <AdminInChargeField
        value={adminId}
        onChange={(id) => {
          setAdminId(id)
          setError(null)
        }}
        error={error?.field}
        disabled={busy}
        reloadKey={reloadKey}
      />

      {error && !error.field && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <div>
            <p className="text-body-strong text-danger">{error.message}</p>
            {error.requestId && <p className="text-caption mt-0.5">Reference: {error.requestId}</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onCreateAdmin(company)}
          className="text-auth-link flex items-center gap-1.5 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <UserPlus className="size-4" aria-hidden="true" /> Create a new Admin instead
        </button>
        <button
          type="button"
          onClick={assign}
          disabled={!adminId || busy}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserCheck className="size-4" aria-hidden="true" />}
          {busy ? 'Saving…' : 'Make them the Admin'}
        </button>
      </div>
    </Section>
  )
}

function Section({ children }) {
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-warning/30 bg-warning-soft/40 px-4 py-3.5">
      <h3 className="text-table-head text-warning">Admin in charge</h3>
      {children}
    </section>
  )
}
