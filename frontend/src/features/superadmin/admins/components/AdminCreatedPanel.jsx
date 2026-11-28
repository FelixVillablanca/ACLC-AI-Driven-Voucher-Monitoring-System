import { useState } from 'react'
import { CircleCheck, Loader2, MailCheck, MailWarning, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { resendInvitation } from '../api'

/**
 * SUCCESS STATE after "Create admin" (no Framer frame yet): who was created, and whether the
 * "set your password" email went out. If it didn't, a Resend button tries again.
 */
export default function AdminCreatedPanel({ result, onCreateAnother, onDone }) {
  const { admin } = result
  const [sent, setSent] = useState(result.invitationSent)
  const [resending, setResending] = useState(false)

  const resend = async () => {
    setResending(true)
    try {
      const to = await resendInvitation(admin.id)
      setSent(true)
      toast.success(`New link sent to ${to}`)
    } catch (error) {
      toast.error(`Couldn't send the email: ${error.message}`)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-4 overflow-y-auto px-6 py-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-success-soft text-success">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-card-title">
              {admin.full_name} is now Admin of {admin.company?.name}
            </p>
            <p className="text-body text-muted-foreground">Shown as Pending until they set their password.</p>
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 rounded-[10px] border bg-muted p-4">
          <dt className="text-caption">Employee ID</dt>
          <dd className="font-mono text-sm">{admin.employee_id}</dd>
          <dt className="text-caption">Signs in as</dt>
          <dd className="text-body-strong break-all">{admin.email}</dd>
          <dt className="text-caption">Company</dt>
          <dd className="text-body">{admin.company?.name}</dd>
        </dl>

        {sent ? (
          <div role="status" className="flex items-start gap-3 rounded-[10px] bg-success-soft px-3.5 py-3">
            <MailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-caption">
              <span className="font-medium text-success">Invitation sent to {admin.personal_email}.</span> The set-password link works once
              and expires in 72 hours.
            </p>
          </div>
        ) : (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-[10px] border border-warning/30 bg-warning-soft px-3.5 py-3"
          >
            <MailWarning className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-caption min-w-0 flex-1">
              <span className="font-medium text-warning">The account was created, but the email couldn&apos;t be sent</span> to{' '}
              {admin.personal_email}. Try again in a moment.
            </p>
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="text-auth-link flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {resending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCw className="size-3.5" aria-hidden="true" />
              )}
              {resending ? 'Sending…' : 'Resend link'}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onCreateAnother}
          className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Create another
        </button>
        <button
          type="button"
          onClick={onDone}
          autoFocus
          className="text-auth-button h-10 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Done
        </button>
      </div>
    </div>
  )
}
