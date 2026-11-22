import { ChevronRight, Crown, Pencil, Power, RotateCcw } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { formatDate, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * The departments table. Clicking a row opens its side panel; the icon buttons edit or (de)activate.
 * `onAction('open' | 'edit' | 'status', department)`.
 * On narrow screens the table scrolls sideways inside its card.
 */
export default function DepartmentsTable({ departments, onAction }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="text-table-head border-b bg-muted text-muted-foreground">
            <th scope="col" className="px-4 py-2.5">
              Department
            </th>
            <th scope="col" className="px-4 py-2.5">
              Head
            </th>
            <th scope="col" className="px-4 py-2.5 text-right">
              People
            </th>
            <th scope="col" className="px-4 py-2.5">
              Status
            </th>
            <th scope="col" className="px-4 py-2.5">
              Added
            </th>
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr
              key={d.id}
              onClick={() => onAction('open', d)}
              className={cn('cursor-pointer border-b last:border-b-0 hover:bg-primary-faint', !d.is_active && 'text-muted-foreground')}
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAction('open', d)
                  }}
                  className="flex flex-col items-start rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="text-body-strong">{d.name}</span>
                  <span className="text-caption font-mono">{d.code}</span>
                </button>
              </td>
              <td className="text-body px-4 py-3">
                {d.head ? (
                  <span className="flex items-center gap-1.5">
                    <Crown className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
                    {d.head.full_name}
                    {!d.head.is_active && <Pill tone="neutral">Deactivated</Pill>}
                  </span>
                ) : (
                  <span className={cn('text-caption', d.is_active && 'text-warning')}>No head yet</span>
                )}
              </td>
              <td className="text-body px-4 py-3 text-right tabular-nums">{formatNumber(d.people_count ?? 0)}</td>
              <td className="px-4 py-3">{d.is_active ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}</td>
              <td className="text-caption px-4 py-3 whitespace-nowrap">{d.created_at ? formatDate(d.created_at, 'MMM d, yyyy') : '—'}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconButton label={`Edit ${d.name}`} onClick={() => onAction('edit', d)}>
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                  {d.is_active ? (
                    <IconButton label={`Deactivate ${d.name}`} onClick={() => onAction('status', d)} className="hover:text-danger">
                      <Power className="size-4" aria-hidden="true" />
                    </IconButton>
                  ) : (
                    <IconButton label={`Reactivate ${d.name}`} onClick={() => onAction('status', d)} className="hover:text-success">
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </IconButton>
                  )}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </td>
            </tr>
          ))}
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
