import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Lock, TriangleAlert, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmailNameField from '@/components/common/EmailNameField'
import ErrorState from '@/components/common/ErrorState'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { updateAdmin } from '../api'
import { useAdminDetail } from '../hooks/useAdminDetail'
import { useAdminFormDefaults } from '../hooks/useAdminFormDefaults'
import { announceAdminsChanged, emailName } from '../utils'

/**
 * "Edit details" (A9, frame JQSwKWYCo). Decided 2026-11-21: ONE company (a select, Admins run
 * one company) + the personal email. The Employee ID is locked. Changing the sign-in email or
 * the company signs them out once; the form says so before saving.
 */
export default function EditAdminModal({ account, onClose }) {
  return (
    <AnimatePresence>
      <Window key={account.id} account={account} onClose={onClose} />
    </AnimatePresence>
  )
}

function Window({ account, onClose }) {
  const detail = useAdminDetail(account.id)
  const defaults = useAdminFormDefaults()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = detail.status === 'success' && defaults.status === 'success'
  const failed = detail.status === 'error' ? detail : defaults.status === 'error' ? defaults : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/45 p-4 sm:items-start sm:pt-16"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-admin-title"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex max-h-[calc(100dvh-2rem)] w-[560px] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="edit-admin-title" className="text-page-title">
              Edit {account.full_name}
            </h2>
            <p className="text-caption">
              Admin{detail.account?.employee_id ? ` · ${detail.account.employee_id}` : ''}. Role changes have their own action in the ⋯
              menu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {!ready && !failed && (
          <div role="status" className="flex items-center justify-center gap-2 p-12">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading…</span>
          </div>
        )}
        {failed && (
          <ErrorState
            title="Couldn't load the form"
            message={failed.error.message}
            requestId={failed.error.requestId}
            onRetry={failed.reload}
          />
        )}
        {ready && <EditForm account={detail.account} companies={defaults.companies} onClose={onClose} />}
      </motion.div>
    </motion.div>
  )
}

function EditForm({ account, companies, onClose }) {
  const original = useMemo(
    () => ({
      first_name: account.first_name ?? '',
      last_name: account.last_name ?? '',
      email_username: emailName(account.email),
      company_id: account.company?.id ?? '',
      personal_email: account.personal_email ?? '',
    }),
    [account],
  )
  const [values, setValues] = useState(original)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Their current company stays in the list even if it's suspended now
  const options = companies.some((c) => c.id === account.company?.id) || !account.company ? companies : [account.company, ...companies]

  const changed = Object.keys(values).filter((k) => String(values[k]).trim().toLowerCase() !== String(original[k]).trim().toLowerCase())
  const emailChanged = changed.includes('email_username')
  const signsOut = emailChanged || changed.includes('company_id')

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }))
    setErrors((er) => ({ ...er, [field]: undefined }))
  }

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      // "" = still no company (only allowed while they have none)
      const result = await updateAdmin(account.id, { ...values, company_id: values.company_id === '' ? null : Number(values.company_id) })
      announceAdminsChanged()
      if (result.changed.length === 0) toast('Nothing to save: no changes')
      else
        toast.success(
          `${result.admin.full_name}'s details were saved${result.invitationResent ? '. A new invitation link was sent' : ''}${
            result.invitationResent === false ? ', but the new invitation email could not be sent' : ''
          }`,
        )
      onClose()
    } catch (err) {
      setBusy(false)
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      else setFormError(err)
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldShell id="edit-first" label="First name" required error={errors.first_name}>
            <input
              id="edit-first"
              value={values.first_name}
              onChange={set('first_name')}
              aria-invalid={!!errors.first_name}
              className={inputClass}
            />
          </FieldShell>
          <FieldShell id="edit-last" label="Last name" required error={errors.last_name}>
            <input
              id="edit-last"
              value={values.last_name}
              onChange={set('last_name')}
              aria-invalid={!!errors.last_name}
              className={inputClass}
            />
          </FieldShell>
        </div>

        <FieldShell id="edit-employee" label="Employee ID">
          <div className="flex h-10 items-center justify-between rounded-lg border bg-muted px-3">
            <span className="text-body">{account.employee_id ?? '—'}</span>
            <span className="text-caption flex items-center gap-1">
              <Lock className="size-3" aria-hidden="true" /> Can’t be changed
            </span>
          </div>
        </FieldShell>

        <div className="flex flex-col gap-1.5">
          <EmailNameField
            role="admin"
            registration={{ name: 'email_username', value: values.email_username, onChange: set('email_username') }}
            value={values.email_username}
            error={errors.email_username}
          />
          {emailChanged && !errors.email_username && (
            <p className="text-caption flex items-center gap-1.5 text-warning">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              Edited · was {original.email_username}. They’ll sign in with the new address.
            </p>
          )}
        </div>

        <FieldShell
          id="edit-company"
          label="Company they manage"
          required={!!account.company}
          error={errors.company_id}
          hint={account.company ? undefined : 'They have no company yet. Choose one to give it to them, or leave it.'}
        >
          <select
            id="edit-company"
            value={values.company_id}
            onChange={set('company_id')}
            aria-invalid={!!errors.company_id}
            className={inputClass}
          >
            {!account.company ? (
              <option value="">No company yet</option>
            ) : (
              !values.company_id && <option value="">Choose a company…</option>
            )}
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldShell>

        <FieldShell
          id="edit-personal"
          label="Personal email"
          error={errors.personal_email}
          hint="Where invitation and password-reset links go."
        >
          <input
            id="edit-personal"
            type="email"
            value={values.personal_email}
            onChange={set('personal_email')}
            aria-invalid={!!errors.personal_email}
            placeholder="name@gmail.com"
            className={inputClass}
          />
        </FieldShell>

        {signsOut && (
          <p className="text-caption rounded-[10px] border border-warning/20 bg-warning-soft px-3 py-2.5">
            Changing the {emailChanged ? 'sign-in email' : 'company'} signs them out on every device once.
          </p>
        )}

        {formError && (
          <div role="alert" className="flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="text-body-strong text-danger">{formError.message}</p>
              {formError.requestId && <p className="text-caption">Reference: {formError.requestId}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <span className="text-caption mr-auto">
          {changed.length === 0 ? 'No changes yet' : `${plural(changed.length, 'change', 'changes')} · recorded in the audit log`}
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || changed.length === 0}
          className={cn(
            'text-auth-button flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save changes
        </button>
      </div>
    </form>
  )
}
