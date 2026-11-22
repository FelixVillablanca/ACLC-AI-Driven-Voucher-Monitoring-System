import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, RotateCw, Search, SearchX, TriangleAlert, UserCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import ModalShell from '@/components/common/ModalShell'
import Pill from '@/components/common/Pill'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { grantCompanyAccess } from '../api'
import { useAccessCandidates } from '../hooks/useAccessCandidates'
import { ACCESS_CHANGED_EVENT, ACCESS_PILLS } from '../utils'

/**
 * "Grant company access" (Quick actions, code-first 2026-11-22). Opens on any admin page with ?grant=access.
 * Lists the people of YOUR company who can't open it yet; tick them and grant in one go.
 * New users already get access when they're created, so this is for older accounts or ones refused before.
 */
export default function GrantAccessModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get('grant') === 'access'

  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete('grant')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  return <AnimatePresence>{open && <Window onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [granted, setGranted] = useState(null) // the people who just got access
  const [round, setRound] = useState(0) // a new round = a fresh list

  return (
    <ModalShell
      title={granted ? 'Access granted' : 'Grant company access'}
      subtitle={
        granted
          ? `${plural(granted.length, 'person', 'people')} can now open ${companyName}.`
          : `Let people in ${companyName} open it. Only people who can't open it yet are listed.`
      }
      width={640}
      onClose={onClose}
    >
      {granted ? (
        <GrantedView
          people={granted}
          companyName={companyName}
          onMore={() => {
            setGranted(null)
            setRound((r) => r + 1)
          }}
          onDone={onClose}
        />
      ) : (
        <Picker
          key={round}
          companyName={companyName}
          onCancel={onClose}
          onGranted={(people) => {
            setGranted(people)
            toast.success(`${plural(people.length, 'person', 'people')} can now open ${companyName}.`)
            window.dispatchEvent(new CustomEvent(ACCESS_CHANGED_EVENT))
          }}
        />
      )}
    </ModalShell>
  )
}

function Picker({ companyName, onCancel, onGranted }) {
  const [text, setText] = useState('')
  const list = useAccessCandidates(text)
  const [selected, setSelected] = useState(() => new Map()) // id -> person (kept while searching)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const visibleIds = useMemo(() => list.people.map((p) => p.id), [list.people])
  const allVisibleTicked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))

  const toggle = (person) =>
    setSelected((m) => {
      const next = new Map(m)
      if (next.has(person.id)) next.delete(person.id)
      else next.set(person.id, person)
      return next
    })

  const toggleAll = () =>
    setSelected((m) => {
      const next = new Map(m)
      if (allVisibleTicked) visibleIds.forEach((id) => next.delete(id))
      else list.people.forEach((p) => next.set(p.id, p))
      return next
    })

  const grant = async () => {
    setBusy(true)
    setError(null)
    try {
      await grantCompanyAccess([...selected.keys()])
      onGranted([...selected.values()])
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  // 409: the list changed under us. Refresh it and drop the ticks, so the Admin picks again.
  const refreshAfterConflict = () => {
    setError(null)
    setSelected(new Map())
    list.reload()
  }

  const noOneAtAll = list.status === 'success' && !list.search && list.people.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pt-4 pb-3">
        {!noOneAtAll && (
          <div className="flex items-center gap-3">
            <label className="flex h-[38px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border bg-muted px-3 focus-within:border-primary focus-within:bg-card">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Search people</span>
              <input
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
                maxLength={100}
                placeholder="Search by name, email or employee ID"
                className="text-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
              />
              {text && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </label>
          </div>
        )}

        <div className="min-h-[220px] flex-1 overflow-y-auto rounded-xl border">
          {list.status === 'loading' && <ListSkeleton />}

          {list.status === 'error' && (
            <ErrorState
              title="Couldn't load the people"
              message={list.error.message}
              requestId={list.error.requestId}
              onRetry={list.reload}
            />
          )}

          {noOneAtAll && (
            <EmptyState
              icon={UserCheck}
              title={`Everyone in ${companyName} has access`}
              description="New users get access when you create them, so there's nothing to grant right now."
            />
          )}

          {list.status === 'success' && list.search && list.people.length === 0 && (
            <EmptyState
              icon={SearchX}
              title={`No one matches “${list.search}”`}
              description="Only people of your company who can't open it yet are listed."
            />
          )}

          {list.status === 'success' && list.people.length > 0 && (
            <>
              <label className="flex cursor-pointer items-center gap-3 border-b bg-muted px-4 py-2.5">
                <input type="checkbox" checked={allVisibleTicked} onChange={toggleAll} className="size-4 accent-primary" />
                <span className="text-table-head text-muted-foreground">
                  {list.search ? 'Select all matches' : 'Select all'} · {plural(list.people.length, 'person', 'people')}
                </span>
              </label>
              <ul>
                {list.people.map((person) => (
                  <PersonRow key={person.id} person={person} checked={selected.has(person.id)} onToggle={() => toggle(person)} />
                ))}
              </ul>
              {list.meta && list.meta.total > list.meta.shown && (
                <p className="text-caption border-t px-4 py-2.5">
                  Showing the first {list.meta.shown} of {list.meta.total}. Search to find someone else.
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-body-strong text-danger">{error.message}</p>
              {error.requestId && <p className="text-caption mt-0.5">Reference: {error.requestId}</p>}
              {error.code === 'ACCESS_LIST_CHANGED' && (
                <button
                  type="button"
                  onClick={refreshAfterConflict}
                  className="text-caption mt-1 flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <RotateCw className="size-3" aria-hidden="true" /> Refresh the list
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-muted px-6 py-3.5">
        <p className="text-caption">
          {selected.size > 0 ? (
            <>
              <span className="font-medium text-foreground">{plural(selected.size, 'person', 'people')}</span> selected ·{' '}
              <button type="button" onClick={() => setSelected(new Map())} className="text-primary hover:underline">
                Clear
              </button>
            </>
          ) : (
            'Saved in the audit log'
          )}
        </p>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {noOneAtAll ? 'Close' : 'Cancel'}
          </button>
          {!noOneAtAll && (
            <button
              type="button"
              onClick={grant}
              disabled={busy || selected.size === 0}
              className="text-auth-button flex h-[38px] items-center gap-2 rounded-lg bg-primary px-[18px] text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {busy ? 'Granting…' : selected.size > 0 ? `Grant access to ${plural(selected.size, 'person', 'people')}` : 'Grant access'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PersonRow({ person, checked, onToggle }) {
  const pill = ACCESS_PILLS[person.access]
  return (
    <li className="border-b last:border-b-0">
      <label
        className={cn(
          'flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted',
          checked && 'bg-primary-faint hover:bg-primary-faint',
        )}
      >
        <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 shrink-0 accent-primary" />
        <span className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          {formatInitials(person)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-body-strong block truncate">{person.full_name}</span>
          <span className="text-caption block truncate">
            {[ROLE_SHORT_LABELS[person.role] ?? person.role, person.department, person.email].filter(Boolean).join(' · ')}
          </span>
        </span>
        {pill && <Pill tone={pill.tone}>{pill.text}</Pill>}
      </label>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading people" className="flex flex-col">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
          <div className="size-4 animate-pulse rounded bg-muted" />
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function GrantedView({ people, companyName, onMore, onDone }) {
  return (
    <>
      <div className="flex flex-col gap-3 overflow-y-auto px-6 py-5">
        <div className="flex items-center gap-2.5 rounded-[10px] bg-success-soft px-3.5 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-caption text-foreground">They can sign in and open {companyName} straight away.</p>
        </div>
        <ul className="flex flex-col rounded-xl border">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
              <span className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                {formatInitials(p)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-body-strong block truncate">{p.full_name}</span>
                <span className="text-caption block truncate">{ROLE_SHORT_LABELS[p.role] ?? p.role}</span>
              </span>
              <Pill tone="success">Access</Pill>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onMore}
          className="text-body-strong mr-auto h-[38px] rounded-lg px-2 text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Grant more
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
    </>
  )
}
