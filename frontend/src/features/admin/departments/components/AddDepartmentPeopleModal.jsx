import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Loader2, Search, TriangleAlert, UserPlus, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import ModalShell from '@/components/common/ModalShell'
import { useDebounce } from '@/hooks/useDebounce'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { addDepartmentPeople, listDepartmentCandidates } from '../api'
import { announceDepartmentsChanged } from '../utils'

/**
 * "Add people" to a department (side panel, user request 2026-11-28). Tick people to add them as members, and
 * optionally mark ONE of them as the head (a department has one head, and the head is always a member).
 *  - only active clerks / officers / supervisors of your company are listed; with none, there's nobody to add or head
 *  - someone in another department is MOVED here (shown as "In HR · moves here"); if they head it, HR loses its head
 *  - replacing the current head must be ticked to confirm
 * department: { id, name, head: { id, full_name } | null }. Render inside <AnimatePresence>.
 */
export default function AddDepartmentPeopleModal({ department, onClose }) {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search.trim(), 300)
  const [list, setList] = useState({ status: 'loading', people: [], companyUsers: 0, error: null })
  const [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState(() => new Map()) // id -> person (kept across searches)
  const [headId, setHeadId] = useState(null)
  const [replaceHead, setReplaceHead] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    listDepartmentCandidates(department.id, debounced)
      .then((r) => !cancelled && setList({ status: 'ready', ...r, error: null }))
      .catch((err) => !cancelled && setList({ status: 'error', people: [], companyUsers: 0, error: err }))
    return () => {
      cancelled = true
    }
  }, [department.id, debounced, attempt])

  const toggle = (person) => {
    if (picked.has(person.id) && headId === person.id) setHeadId(null) // un-ticking the head: no head picked
    setPicked((prev) => {
      const next = new Map(prev)
      if (next.has(person.id)) next.delete(person.id)
      else next.set(person.id, person)
      return next
    })
  }

  const chooseHead = (person) => {
    setPicked((prev) => (prev.has(person.id) ? prev : new Map(prev).set(person.id, person)))
    setHeadId((id) => (id === person.id ? null : person.id))
  }

  const head = headId ? picked.get(headId) : null
  const replacing = Boolean(head && department.head)
  const moving = [...picked.values()].filter((p) => p.department)
  const leavingHeads = moving.filter((p) => p.heads_department)
  const canSave = picked.size > 0 && (!replacing || replaceHead) && !busy

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await addDepartmentPeople(department.id, { userIds: [...picked.keys()], headId, replaceHead })
      announceDepartmentsChanged()
      toast.success(`${plural(r.added, 'person', 'people')} added to ${department.name}${r.head ? `. ${r.head} is its head now` : ''}.`)
      onClose()
    } catch (err) {
      setBusy(false)
      if (err.code === 'DEPARTMENT_HAS_HEAD') announceDepartmentsChanged() // someone else set a head meanwhile
      setError(err.errors?.user_ids ? { ...err, message: err.errors.user_ids[0] } : err)
      setAttempt((n) => n + 1) // the list may have changed
    }
  }

  const noUsers = list.status === 'ready' && list.companyUsers === 0

  return (
    <ModalShell
      title={`Add people to ${department.name}`}
      subtitle="Tick people to add them as members. Mark one as the head if you like: a department has one head."
      width={620}
      onClose={onClose}
      keepOpenOnBackdrop={picked.size > 0}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-5">
        {!noUsers && (
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or employee ID"
              aria-label="Search people"
              className="text-body h-10 w-full rounded-lg border bg-card pr-3 pl-9 outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        )}

        {list.status === 'loading' && (
          <div role="status" className="text-caption flex items-center gap-2 py-6">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading your company’s people…
          </div>
        )}

        {list.status === 'error' && (
          <ErrorState
            title="Couldn’t load the people"
            message={list.error?.message}
            onRetry={() => setAttempt((n) => n + 1)}
            className="p-4"
          />
        )}

        {noUsers && (
          <EmptyState
            icon={Users}
            title="Your company has no active users yet"
            description="Create users first. Then you can add them here and choose the department’s head."
            className="p-6"
            action={
              <Link
                to={{ search: '?create=user' }}
                onClick={onClose}
                className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <UserPlus className="size-4" aria-hidden="true" /> Create user
              </Link>
            }
          />
        )}

        {list.status === 'ready' && !noUsers && list.people.length === 0 && (
          <p className="text-caption py-4 text-center">
            {debounced ? `Nobody matches “${debounced}”.` : `Everyone active in your company is already in ${department.name}.`}
          </p>
        )}

        {list.status === 'ready' && list.people.length > 0 && (
          <ul className="flex flex-col rounded-xl border" aria-label="People you can add">
            {list.people.map((p) => {
              const checked = picked.has(p.id)
              const isHead = headId === p.id
              return (
                <li
                  key={p.id}
                  className={cn('flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0', checked && 'bg-primary-faint')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p)}
                    disabled={busy}
                    aria-label={`Add ${p.full_name}`}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    {formatInitials(p)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-body-strong block truncate">{p.full_name}</span>
                    <span className="text-caption block truncate">
                      {ROLE_SHORT_LABELS[p.role] ?? p.role} · {p.email}
                      {p.department && (
                        <span className="text-warning">
                          {' '}
                          · In {p.department.name}
                          {p.heads_department ? ' (its head)' : ''} · moves here
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isHead}
                    onClick={() => chooseHead(p)}
                    disabled={busy}
                    className={cn(
                      'text-badge flex h-8 shrink-0 items-center gap-1 rounded-full border px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      isHead ? 'border-warning bg-warning-soft text-warning' : 'bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Crown className="size-3.5" aria-hidden="true" /> {isHead ? 'Head' : 'Make head'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {leavingHeads.length > 0 && (
          <p className="text-caption flex items-start gap-1.5 text-warning">
            <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {leavingHeads.map((p) => `${p.department.name} will have no head after ${p.full_name} moves.`).join(' ')}
          </p>
        )}

        {replacing && (
          <label className="flex items-start gap-2.5 rounded-[10px] bg-warning-soft px-3.5 py-3">
            <input
              type="checkbox"
              checked={replaceHead}
              onChange={(e) => setReplaceHead(e.target.checked)}
              disabled={busy}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="text-caption text-foreground">
              <span className="font-medium">Replace {department.head.full_name} as head.</span> {head.full_name} becomes the head;{' '}
              {department.head.full_name} stays a member.
            </span>
          </label>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="text-body-strong text-danger">{error.message}</p>
              {error.requestId && <p className="text-caption mt-0.5">Reference: {error.requestId}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <p className="text-caption mr-auto">
          {picked.size === 0
            ? 'Nobody picked yet'
            : `${plural(picked.size, 'person', 'people')} picked${moving.length ? ` · ${moving.length} moving from another department` : ''}${head ? ` · head: ${head.full_name}` : ''}`}
        </p>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-body-strong h-10 rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="text-auth-button flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? 'Adding…' : picked.size > 0 ? `Add ${plural(picked.size, 'person', 'people')}` : 'Add people'}
        </button>
      </div>
    </ModalShell>
  )
}
