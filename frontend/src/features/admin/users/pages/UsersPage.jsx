import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Clock, Layers, Plus, Search, SearchX, UserCheck, Users, UserX, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { useDebounce } from '@/hooks/useDebounce'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import EditUserModal from '../components/EditUserModal'
import SetPasswordDialog from '../components/SetPasswordDialog'
import UserPanel from '../components/UserPanel'
import UserStatusDialog from '../components/UserStatusDialog'
import UsersTable from '../components/UsersTable'
import { useCompanyOptions } from '../hooks/useCompanyOptions'
import { useUsers } from '../hooks/useUsers'
import { ROLE_OPTIONS } from '../schemas'
import { SORTS, VIEWS } from '../utils'

const DIALOGS = { edit: EditUserModal, status: UserStatusDialog, password: SetPasswordDialog }

/**
 * People & Access → Users (code-first 2026-11-22): the clerks, officers and supervisors of the
 * Admin's own company. Admin accounts are managed by the Super Admin, so they aren't listed.
 *
 * The ADDRESS holds every filter and the open side panel
 * (?view=pending&role=accounting_clerk&department=3|none&q=maria&sort=newest&page=2&user=12),
 * so Back, refresh and a shared link show the same thing. The top-bar search opens ?user={id}.
 */
export default function UsersPage() {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [params, setParams] = useSearchParams()
  const view = params.get('view')
  const role = params.get('role')
  const department = params.get('department')
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const page = Number(params.get('page')) || 1
  const openId = Number(params.get('user')) || null

  const list = useUsers({ view, role, department, search, sort: sort === 'name' ? undefined : sort, page })
  const options = useCompanyOptions()
  const departments = options.companies.find((c) => c.is_active)?.departments ?? []
  const [dialog, setDialog] = useState(null) // { type: 'edit' | 'status' | 'password', user }

  const [searchText, setSearchText] = useState(search)
  const debouncedSearch = useDebounce(searchText.trim(), 300)

  const update = useCallback(
    (changes, { keepPage = false } = {}) =>
      setParams(
        (p) => {
          Object.entries(changes).forEach(([key, value]) => (value ? p.set(key, String(value)) : p.delete(key)))
          if (!keepPage) p.delete('page')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  useEffect(() => {
    if (debouncedSearch !== search) update({ q: debouncedSearch })
  }, [debouncedSearch, search, update])

  const filtered = Boolean(search || view || role || department)
  const clearFilters = () => {
    setSearchText('')
    update({ q: null, view: null, role: null, department: null })
  }

  const onAction = (type, user) => {
    if (type === 'open') update({ user: user.id }, { keepPage: true })
    else setDialog({ type, user })
  }

  const closePanel = useCallback(() => update({ user: null }, { keepPage: true }), [update])
  const openCreate = () => update({ create: 'user' }, { keepPage: true })

  const meta = list.meta
  const users = list.users
  const Dialog = dialog && DIALOGS[dialog.type]

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Users</h1>
          <p className="text-body text-muted-foreground">
            The clerks, officers and supervisors of {companyName}. Admin accounts are managed by a Super Admin.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" /> Add user
        </button>
      </div>

      <SummaryCards
        summary={meta?.summary}
        onView={(v) => update({ view: v, role: null, department: null })}
        onNoDepartment={() => update({ department: 'none', view: null })}
      />

      <div role="tablist" aria-label="Views" className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-card p-[3px]">
        {VIEWS.map((v) => {
          const active = (view ?? null) === v.key
          const amber = active && v.tone === 'warning'
          return (
            <button
              key={v.count}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ view: v.key })}
              className={cn(
                'flex h-8 shrink-0 items-center rounded-md px-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'text-badge' : 'text-caption hover:bg-muted',
                active && (amber ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'),
              )}
            >
              {v.label}
              {meta?.views && ` ${meta.views[v.count] ?? 0}`}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary sm:max-w-[320px]">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            maxLength={100}
            placeholder="Search name, email or employee ID…"
            aria-label="Search users"
            className="text-body min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              aria-label="Clear search"
              className="flex size-[18px] items-center justify-center rounded-full bg-muted text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>

        <FilterSelect label="Role" value={role ?? ''} onChange={(v) => update({ role: v })}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {ROLE_SHORT_LABELS[r.value] ?? r.label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="Department" value={department ?? ''} onChange={(v) => update({ department: v })}>
          <option value="">All departments</option>
          <option value="none">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          {department && department !== 'none' && !departments.some((d) => String(d.id) === department) && (
            <option value={department}>A deactivated department</option>
          )}
        </FilterSelect>

        <FilterSelect label="Sort" value={sort} onChange={(v) => update({ sort: v === 'name' ? null : v })}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </FilterSelect>

        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-caption rounded font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Clear filters
          </button>
        )}
      </div>

      {list.status === 'loading' && <TableSkeleton />}

      {list.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState title="Couldn't load the users" message={list.error.message} requestId={list.error.requestId} onRetry={list.reload} />
        </div>
      )}

      {list.status === 'success' && users.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={filtered ? SearchX : Users}
            title={search ? `No one matches “${search}”` : filtered ? 'No users match these filters' : 'No users yet'}
            description={
              filtered
                ? 'Try another search, or clear the filters to see everyone.'
                : `Create the first clerk, officer or supervisor of ${companyName}.`
            }
            action={
              filtered ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCreate}
                  className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Plus className="size-4" aria-hidden="true" /> Add user
                </button>
              )
            }
          />
        </div>
      )}

      {list.status === 'success' && users.length > 0 && <UsersTable users={users} onAction={onAction} />}

      {list.status === 'success' && meta && meta.total > 0 && (
        <div className="text-caption flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing {meta.from}–{meta.to} of {plural(meta.total, 'user', 'users')}
          </p>
          {meta.last_page > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-2">
              <PagerButton
                disabled={meta.current_page <= 1}
                onClick={() => update({ page: meta.current_page - 1 > 1 ? meta.current_page - 1 : null }, { keepPage: true })}
              >
                ‹ Previous
              </PagerButton>
              <span aria-current="page">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <PagerButton
                disabled={meta.current_page >= meta.last_page}
                onClick={() => update({ page: meta.current_page + 1 }, { keepPage: true })}
              >
                Next ›
              </PagerButton>
            </nav>
          )}
        </div>
      )}

      <AnimatePresence>
        {openId && <UserPanel key={`panel-${openId}`} id={openId} onClose={closePanel} onAction={onAction} />}
      </AnimatePresence>
      <AnimatePresence>{Dialog && <Dialog key={dialog.type} user={dialog.user} onClose={() => setDialog(null)} />}</AnimatePresence>
    </div>
  )
}

function SummaryCards({ summary, onView, onNoDepartment }) {
  const cards = [
    { label: 'Users', value: summary?.total, icon: Users, tone: 'bg-primary-soft text-primary', onClick: () => onView(null) },
    { label: 'Active', value: summary?.active, icon: UserCheck, tone: 'bg-success-soft text-success', onClick: () => onView('active') },
    {
      label: 'Never signed in',
      value: summary?.pending,
      icon: Clock,
      tone: summary?.pending ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
      onClick: () => onView('pending'),
    },
    {
      label: 'Deactivated',
      value: summary?.inactive,
      icon: UserX,
      tone: 'bg-muted text-muted-foreground',
      onClick: () => onView('inactive'),
    },
    {
      label: 'No department',
      value: summary?.without_department,
      icon: Layers,
      tone: summary?.without_department ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
      onClick: onNoDepartment,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', c.tone)}>
            <c.icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="text-caption block truncate">{c.label}</span>
            {summary ? (
              <span className="text-card-title block">{formatNumber(c.value ?? 0)}</span>
            ) : (
              <span className="mt-1 block h-4 w-10 animate-pulse rounded bg-muted" />
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-body-strong h-[38px] max-w-[220px] appearance-none rounded-lg border bg-card pr-9 pl-3 outline-none focus:border-primary"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  )
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading users" className="flex flex-col rounded-xl border bg-card">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}

function PagerButton({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-body-strong h-[34px] rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}
