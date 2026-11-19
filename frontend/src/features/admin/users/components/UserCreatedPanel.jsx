import { CircleCheck, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROLE_LABELS } from '@/lib/constants'

/**
 * SUCCESS STATE after "Create user": the new user's sign-in details
 * (Employee ID, email, the generated password) so the admin can hand them over.
 */
export default function UserCreatedPanel({ result, onCreateAnother, onDone }) {
  const { user, password } = result

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${user.email}\nPassword: ${password}`)
      toast.success('Sign-in details copied')
    } catch {
      toast.error("Couldn't copy automatically. Select the details and copy them by hand.")
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
            <p className="text-card-title">{user.full_name} was created</p>
            <p className="text-body text-muted-foreground">
              {ROLE_LABELS[user.role]} · {user.company?.name}
              {user.department ? ` · ${user.department.name}` : ''}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 rounded-[10px] border bg-muted p-4">
          <dt className="text-caption">Employee ID</dt>
          <dd className="font-mono text-sm">{user.employee_id}</dd>
          <dt className="text-caption">Email</dt>
          <dd className="text-body-strong break-all">{user.email}</dd>
          <dt className="text-caption">Password</dt>
          <dd className="font-mono text-base tracking-wider select-all">{password}</dd>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-caption max-w-md">
            Share these privately. The password isn&apos;t shown again after you close this (only a scrambled version is stored).
          </p>
          <button
            type="button"
            onClick={copy}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Copy className="size-4" aria-hidden="true" /> Copy sign-in details
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onCreateAnother}
          className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Create another
        </button>
        <button
          type="button"
          onClick={onDone}
          autoFocus
          className="text-auth-button h-[38px] rounded-lg bg-primary px-[18px] text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Done
        </button>
      </div>
    </div>
  )
}
