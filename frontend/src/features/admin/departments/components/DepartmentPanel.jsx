import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Crown, Layers, Loader2, Pencil, Power, RotateCcw, UserMinus, UserPlus, Users } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatDate, formatInitials, plural } from '@/lib/formatters'
import { useDepartmentDetail } from '../hooks/useDepartmentDetail'
import AddDepartmentPeopleModal from './AddDepartmentPeopleModal'
import DepartmentMemberDialog from './DepartmentMemberDialog'

const STATUS = {
  active: null,
  pending: { tone: 'warning', text: 'Pending' },
  inactive: { tone: 'neutral', text: 'Inactive' },
}

/**
 * The department side panel (opens with ?department={id}): details, head, and the people in it.
 * Since 2026-11-28 the People list can be changed here: "Add people" (as members, one of them as head), and per
 * person Make head / Remove as head / Remove from department (rules: ManageDepartmentPeople on the server).
 * Render it inside <AnimatePresence> while open. `onAction('edit' | 'status', department)`.
 */
export default function DepartmentPanel({ id, onClose, onAction }) {
  const detail = useDepartmentDetail(id)
  const d = detail.department
  const [adding, setAdding] = useState(false)
  const [change, setChange] = useState(null) // { type: 'make_head' | 'remove_head' | 'remove', person }

  const footer = d && (
    <>
      <button
        type="button"
        onClick={() => onAction('status', d)}
        className="text-body-strong mr-auto flex h-[38px] items-center gap-1.5 rounded-lg px-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {d.is_active ? (
          <>
            <Power className="size-4 text-danger" aria-hidden="true" /> <span className="text-danger">Deactivate</span>
          </>
        ) : (
          <>
            <RotateCcw className="size-4 text-success" aria-hidden="true" /> <span className="text-success">Reactivate</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => onAction('edit', d)}
        className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Pencil className="size-4" aria-hidden="true" /> Edit details
      </button>
    </>
  )

  return (
    <SidePanel label={d ? `${d.name} department` : 'Department'} width={480} onClose={onClose} footer={footer}>
      <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Layers className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {d ? (
            <>
              <p className="text-card-title truncate">{d.name}</p>
              <p className="text-caption flex flex-wrap items-center gap-1.5">
                <span className="font-mono">{d.code}</span>
                {d.is_active ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
            </div>
          )}
        </div>
        <PanelClose onClick={onClose} />
      </div>

      {detail.status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 p-12">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the department…</span>
        </div>
      )}

      {detail.status === 'error' && (
        <ErrorState
          title={detail.error.status === 404 ? 'Department not found' : "Couldn't load the department"}
          message={detail.error.status === 404 ? "It isn't one of your company's departments." : detail.error.message}
          requestId={detail.error.requestId}
          onRetry={detail.error.status === 404 ? undefined : detail.reload}
        />
      )}

      {d && (
        <div className="flex flex-col gap-5 px-6 py-5">
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="People" value={plural(d.people_count ?? 0, 'person', 'people')} />
            <Fact label="Added" value={d.created_at ? formatDate(d.created_at, 'MMM d, yyyy') : '—'} />
            <div className="col-span-2">
              <Fact
                label="Head"
                value={
                  d.head ? (
                    <span className="flex items-center gap-1.5">
                      <Crown className="size-3.5 text-warning" aria-hidden="true" /> {d.head.full_name}
                      {!d.head.is_active && <Pill tone="neutral">Deactivated</Pill>}
                    </span>
                  ) : (
                    <span className="text-warning">No head yet</span>
                  )
                }
              />
            </div>
            {d.description && (
              <div className="col-span-2">
                <Fact label="Description" value={<span className="font-normal">{d.description}</span>} />
              </div>
            )}
          </dl>

          {!d.is_active && (
            <p className="text-caption rounded-[10px] bg-muted px-3.5 py-2.5">
              Deactivated: it can't be chosen for new users. The people below stay in it.
            </p>
          )}

          <Members
            department={d}
            members={detail.members}
            onAdd={() => setAdding(true)}
            onChange={(type, person) => setChange({ type, person })}
          />
        </div>
      )}

      <AnimatePresence>{adding && d && <AddDepartmentPeopleModal department={d} onClose={() => setAdding(false)} />}</AnimatePresence>
      <AnimatePresence>
        {change && d && <DepartmentMemberDialog type={change.type} department={d} person={change.person} onClose={() => setChange(null)} />}
      </AnimatePresence>
    </SidePanel>
  )
}

function Fact({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] border bg-muted px-3 py-2">
      <dt className="text-caption">{label}</dt>
      <dd className="text-body-strong">{value}</dd>
    </div>
  )
}

function Members({ department, members, onAdd, onChange }) {
  return (
    <section aria-labelledby="dept-members" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 id="dept-members" className="text-table-head text-muted-foreground">
          People {members.status === 'success' && `· ${members.total}`}
        </h3>
        {department.is_active && (
          <button
            type="button"
            onClick={onAdd}
            className="text-body-strong flex h-[32px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <UserPlus className="size-4" aria-hidden="true" /> Add people
          </button>
        )}
      </div>

      {members.status === 'loading' && (
        <div role="status" className="text-caption flex items-center gap-2 py-3">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading people…
        </div>
      )}

      {members.status === 'error' && (
        <ErrorState title="Couldn't load the people" message={members.error?.message} onRetry={members.retry} className="p-4" />
      )}

      {members.status === 'success' && members.items.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nobody in this department yet"
          description={
            department.is_active
              ? 'Add people from your company, or choose this department when you create a user.'
              : 'Reactivate the department to add people.'
          }
          className="p-6"
          action={
            <Link
              to={{ search: '?create=user' }}
              className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <UserPlus className="size-4" aria-hidden="true" /> Create user
            </Link>
          }
        />
      )}

      {members.items.length > 0 && (
        <ul className="flex flex-col rounded-xl border">
          {members.items.map((p) => {
            const pill = STATUS[p.status]
            return (
              <li key={p.id} className="flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0">
                <span className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  {formatInitials(p)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-body-strong flex items-center gap-1.5 truncate">
                    {p.full_name}
                    {p.id === members.headId && <Crown className="size-3.5 shrink-0 text-warning" aria-label="Department head" />}
                  </span>
                  <span className="text-caption block truncate">
                    {ROLE_SHORT_LABELS[p.role] ?? p.role} · {p.email}
                  </span>
                </span>
                {pill && <Pill tone={pill.tone}>{pill.text}</Pill>}
                <MemberActions
                  person={p}
                  isHead={p.id === members.headId}
                  canHead={department.is_active && p.status !== 'inactive'}
                  onChange={onChange}
                />
              </li>
            )
          })}
        </ul>
      )}

      {members.hasMore && (
        <button
          type="button"
          onClick={members.loadMore}
          className="text-body-strong h-[34px] w-fit rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Show more ({members.items.length} of {members.total})
        </button>
      )}
    </section>
  )
}

/** Per person: Make head / Remove as head (a crown button) and Remove from department. */
function MemberActions({ person, isHead, canHead, onChange }) {
  const button =
    'flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50'
  return (
    <span className="flex shrink-0 items-center">
      {isHead ? (
        <button
          type="button"
          onClick={() => onChange('remove_head', person)}
          title="Remove as head"
          aria-label={`Remove ${person.full_name} as head`}
          className={`${button} text-warning hover:text-warning`}
        >
          <Crown className="size-4" aria-hidden="true" />
        </button>
      ) : (
        canHead && (
          <button
            type="button"
            onClick={() => onChange('make_head', person)}
            title="Make head"
            aria-label={`Make ${person.full_name} the head`}
            className={`${button} hover:text-warning`}
          >
            <Crown className="size-4" aria-hidden="true" />
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange('remove', person)}
        title="Remove from department"
        aria-label={`Remove ${person.full_name} from the department`}
        className={`${button} hover:text-danger`}
      >
        <UserMinus className="size-4" aria-hidden="true" />
      </button>
    </span>
  )
}
