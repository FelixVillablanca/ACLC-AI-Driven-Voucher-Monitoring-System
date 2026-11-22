import { ChevronRight, KeyRound, Pencil, RotateCcw, UserX } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { lastSignInText, statusPill } from '../utils'

/**
 * The users table. Clicking a row opens the person's side panel; the icon buttons edit,
 * set a new password, or (de)activate. `onAction('open' | 'edit' | 'password' | 'status', user)`.
 * On narrow screens it scrolls sideways inside its card.
 */
export default function UsersTable({ users, onAction }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[860px] text-left">
        <thead>
          <tr className="text-table-head border-b bg-muted text-muted-foreground">
            {['User', 'Employee ID', 'Role', 'Department', 'Status', 'Last sign-in'].map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5">
                {h}
              </th>
            ))}
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const pill = statusPill(u.status)
            const inactive = u.status === 'inactive'
            return (
              <tr
                key={u.id}
                onClick={() => onAction('open', u)}
                className={cn('cursor-pointer border-b last:border-b-0 hover:bg-primary-faint', inactive && 'text-muted-foreground')}
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAction('open', u)
                    }}
                    className="flex items-center gap-3 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span
                      className={cn(
                        'text-badge flex size-8 shrink-0 items-center justify-center rounded-full',
                        inactive ? 'bg-muted text-muted-foreground' : 'bg-primary-soft text-primary',
                      )}
                    >
                      {formatInitials(u)}
                    </span>
                    <span className="min-w-0">
                      <span className="text-body-strong block">{u.full_name}</span>
                      <span className="text-caption block">{u.email}</span>
                    </span>
                  </button>
                </td>
                <td className="text-caption px-4 py-3 font-mono whitespace-nowrap">{u.employee_id ?? '—'}</td>
                <td className="text-body px-4 py-3">{ROLE_SHORT_LABELS[u.role] ?? u.role}</td>
                <td className="text-body px-4 py-3">
                  {u.department ? u.department.name : <span className="text-caption">No department</span>}
                </td>
                <td className="px-4 py-3">
                  <Pill tone={pill.tone}>{pill.text}</Pill>
                </td>
                <td className="text-caption px-4 py-3 whitespace-nowrap">{lastSignInText(u.last_login_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <IconButton label={`Edit ${u.full_name}`} onClick={() => onAction('edit', u)}>
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    {!inactive && (
                      <IconButton label={`Set a new password for ${u.full_name}`} onClick={() => onAction('password', u)}>
                        <KeyRound className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                    {inactive ? (
                      <IconButton label={`Reactivate ${u.full_name}`} onClick={() => onAction('status', u)} className="hover:text-success">
                        <RotateCcw className="size-4" aria-hidden="true" />
                      </IconButton>
                    ) : (
                      <IconButton label={`Deactivate ${u.full_name}`} onClick={() => onAction('status', u)} className="hover:text-danger">
                        <UserX className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function IconButton({ label, onClick, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      {children}
    </button>
  )
}
