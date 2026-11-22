import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Building2, Layers, RotateCw, Search, X } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { useDismiss } from '@/hooks/useDismiss'
import { PATHS, ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { MIN_LENGTH, useAdminSearch } from '../hooks/useAdminSearch'

const STATUS_PILL = {
  pending: { tone: 'warning', label: 'Pending' },
  inactive: { tone: 'neutral', label: 'Inactive' },
}

/**
 * The Admin top-bar search. It only finds the Admin's OWN company's users and departments
 * (the server enforces that; the dropdown says so in its header).
 * Keyboard: "/" jumps into the box, ↑ ↓ move, Enter opens, Esc closes.
 * Picking a result opens the Users / Departments page filtered to that name.
 */
export default function AdminSearchBox() {
  const navigate = useNavigate()
  const companyName = useAuthStore((s) => s.user?.company?.name)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [activeKey, setActiveKey] = useState(null)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const search = useAdminSearch(text)

  // One flat list for the keyboard (people first, then departments)
  const results = useMemo(
    () => [
      ...search.users.map((u) => ({
        kind: 'user',
        key: `u${u.id}`,
        item: u,
        to: `${PATHS.ADMIN_USERS}?user=${u.id}`, // opens their side panel
      })),
      ...search.departments.map((d) => ({
        kind: 'department',
        key: `d${d.id}`,
        item: d,
        to: `${PATHS.ADMIN_DEPARTMENTS}?department=${d.id}`, // opens its side panel
      })),
    ],
    [search.users, search.departments],
  )

  // The highlighted row is remembered by its key, so new results simply un-highlight it
  const active = results.findIndex((r) => r.key === activeKey)
  const setActive = (index) => setActiveKey(results[index]?.key ?? null)

  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, wrapperRef, close)

  // "/" anywhere (outside a text field) focuses the search
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = (result) => {
    setOpen(false)
    setText('')
    inputRef.current?.blur()
    navigate(result.to)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault()
      setOpen(true)
      setActive((active + 1) % results.length)
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault()
      setActive(active <= 0 ? results.length - 1 : active - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = results[active] ?? (results.length === 1 ? results[0] : null)
      if (pick) go(pick)
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const scope = companyName ?? 'your company'

  return (
    <div ref={wrapperRef} className="relative hidden md:block">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="flex h-[38px] w-[360px] max-w-full items-center gap-2.5 rounded-lg border bg-muted px-3 focus-within:border-primary focus-within:bg-card">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search users and departments in {scope}</span>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${results[active]?.key}` : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search users and departments…"
            maxLength={100}
            className="text-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {text ? (
            <button
              type="button"
              onClick={() => {
                setText('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : (
            <kbd className="text-caption rounded border bg-card px-1.5 leading-5" aria-hidden="true">
              /
            </kbd>
          )}
        </label>
      </form>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-30 w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b bg-muted px-3.5 py-2">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-caption truncate">
              Searching <span className="font-medium text-foreground">{scope}</span> only
            </p>
          </div>

          <div id={listId} role="listbox" aria-label="Search results" className="max-h-[360px] overflow-y-auto py-1.5">
            <Body search={search} results={results} active={active} setActive={setActive} go={go} listId={listId} scope={scope} />
          </div>
        </div>
      )}
    </div>
  )
}

function Body({ search, results, active, setActive, go, listId, scope }) {
  if (search.status === 'idle') {
    return <p className="text-caption px-3.5 py-3">Type at least {MIN_LENGTH} letters: a name, email, employee ID or department.</p>
  }

  if (search.status === 'loading') {
    return (
      <div className="flex flex-col gap-1 px-2" aria-busy="true" aria-label="Searching">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-1.5 py-2">
            <div className="size-8 animate-pulse rounded-full bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (search.status === 'error') {
    return (
      <div className="flex items-start gap-2.5 px-3.5 py-3" role="alert">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-body-strong">Couldn't search right now</p>
          <p className="text-caption">{search.error?.message ?? 'Something went wrong.'}</p>
          <button
            type="button"
            onClick={search.retry}
            className="text-caption flex w-fit items-center gap-1 font-medium text-primary hover:underline"
          >
            <RotateCw className="size-3" aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    )
  }

  if (!results.length) {
    return (
      <div className="px-3.5 py-4 text-center">
        <p className="text-body-strong">No matches for “{search.term}”</p>
        <p className="text-caption mt-1">
          No users or departments in {scope} match that. Check the spelling, or try an email or employee ID.
        </p>
      </div>
    )
  }

  const users = results.filter((r) => r.kind === 'user')
  const departments = results.filter((r) => r.kind === 'department')
  const rowProps = (r) => ({
    id: `${listId}-${r.key}`,
    selected: results[active]?.key === r.key,
    onHover: () => setActive(results.indexOf(r)),
    onPick: () => go(r),
  })

  return (
    <>
      {users.length > 0 && (
        <Group label="People">
          {users.map((r) => (
            <UserRow key={r.key} user={r.item} {...rowProps(r)} />
          ))}
        </Group>
      )}
      {departments.length > 0 && (
        <Group label="Departments">
          {departments.map((r) => (
            <DepartmentRow key={r.key} department={r.item} {...rowProps(r)} />
          ))}
        </Group>
      )}
    </>
  )
}

function Group({ label, children }) {
  return (
    <div role="group" aria-label={label} className="px-1.5 pb-1">
      <p className="text-table-head px-2 pt-2 pb-1 text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Row({ id, selected, onHover, onPick, children }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()} // keep focus in the input
      onClick={onPick}
      className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2', selected && 'bg-primary-faint')}
    >
      {children}
    </div>
  )
}

function UserRow({ user, ...row }) {
  const pill = STATUS_PILL[user.status]
  const [first, ...rest] = user.full_name.split(' ')
  return (
    <Row {...row}>
      <span className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        {formatInitials({ first_name: first, last_name: rest.join(' ') })}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-strong truncate">{user.full_name}</p>
        <p className="text-caption truncate">
          {[ROLE_SHORT_LABELS[user.role] ?? user.role, user.department, user.email].filter(Boolean).join(' · ')}
        </p>
      </div>
      {pill && <Pill tone={pill.tone}>{pill.label}</Pill>}
    </Row>
  )
}

function DepartmentRow({ department, ...row }) {
  return (
    <Row {...row}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Layers className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-strong truncate">
          {department.name} <span className="text-caption">{department.code}</span>
        </p>
        <p className="text-caption truncate">
          {plural(department.users_count, 'user', 'users')}
          {department.head ? ` · Head: ${department.head}` : ' · No head yet'}
        </p>
      </div>
      {!department.is_active && <Pill tone="neutral">Inactive</Pill>}
    </Row>
  )
}
