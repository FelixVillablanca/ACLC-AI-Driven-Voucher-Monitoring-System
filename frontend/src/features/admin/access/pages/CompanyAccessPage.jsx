import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Building2, ChevronDown, Plus, Search, SearchX, ShieldCheck, ShieldOff, UserPlus, Users, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, formatNumber, formatTimeAgo, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import RemoveAccessDialog from '../components/RemoveAccessDialog'
import { useCompanyAccess } from '../hooks/useCompanyAccess'
import { accessPill, GRANT_ACCESS_SEARCH, SORTS, VIEWS } from '../utils'

/**
 * People & Access → Company access (code-first 2026-11-22). One company: the Admin's own.
 * Everyone connected to it (its own people, and people of other companies given access) with
 * their access status, who changed it and when. "Grant access" opens the shared dialog
 * (?grant=access); "Remove access" keeps the history (the row becomes "removed").
 * The ADDRESS holds ?view=&q=&sort=&page=.
 */
export default function CompanyAccessPage() {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [params, setParams] = useSearchParams()
  const view = params.get('view')
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const page = Number(params.get('page')) || 1

  const list = useCompanyAccess({ view, search, sort: sort === 'name' ? undefined : sort, page })
  const [removing, setRemoving] = useState(null)

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

  const filtered = Boolean(search || view)
  const clearFilters = () => {
    setSearchText('')
    update({ q: null, view: null })
  }
  const openGrant = () => update({ grant: GRANT_ACCESS_SEARCH.split('=')[1] }, { keepPage: true })

  const meta = list.meta
  const people = list.people
  const canGrant = meta?.summary?.can_be_granted ?? 0

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Company access</h1>
          <p className="text-body text-muted-foreground">Who can open {companyName}. New users get access when you create them.</p>
        </div>
        <button
          type="button"
          onClick={openGrant}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" /> Grant access
          {canGrant > 0 && <span className="text-badge rounded-full bg-white/20 px-1.5">{canGrant}</span>}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Have access"
          value={meta?.summary?.has_access}
          icon={ShieldCheck}
          tone="bg-success-soft text-success"
          onClick={() => update({ view: 'has_access' })}
        />
        <Card
          label="No access"
          value={meta?.summary?.no_access}
          icon={ShieldOff}
          tone={meta?.summary?.no_access ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground'}
          onClick={() => update({ view: 'no_access' })}
        />
        <Card
          label="From other companies"
          value={meta?.summary?.other_companies}
          icon={Building2}
          tone="bg-primary-soft text-primary"
          onClick={() => update({ view: 'other_companies' })}
        />
        <Card
          label="Can be granted now"
          value={meta?.summary?.can_be_granted}
          icon={UserPlus}
          tone={canGrant ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground'}
          onClick={openGrant}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="tablist" aria-label="Views" className="flex max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-card p-[3px]">
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

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <div className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 focus-within:border-primary focus-within:ring-[0.5px] focus-within:ring-primary sm:w-[260px] sm:flex-none">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              maxLength={100}
              placeholder="Search people…"
              aria-label="Search people by name, email or employee ID"
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
          <label className="relative">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'name' ? null : e.target.value })}
              className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-9 pl-3 outline-none focus:border-primary"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
        </div>
      </div>

      {list.status === 'loading' && <ListSkeleton />}

      {list.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load company access"
            message={list.error.message}
            requestId={list.error.requestId}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.status === 'success' && people.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={filtered ? SearchX : Users}
            title={
              search
                ? `No one matches “${search}”`
                : view === 'no_access'
                  ? `Everyone can open ${companyName}`
                  : view === 'other_companies'
                    ? 'Nobody from other companies'
                    : view
                      ? 'Nobody in this view'
                      : 'No people yet'
            }
            description={
              search
                ? 'Try another name, email or employee ID.'
                : view === 'no_access'
                  ? 'Nobody is waiting for access right now.'
                  : view
                    ? 'Show everyone to see the others.'
                    : 'Create users first. They get access to your company when you create them.'
            }
            action={
              filtered && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show everyone
                </button>
              )
            }
          />
        </div>
      )}

      {list.status === 'success' && people.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="text-table-head border-b bg-muted text-muted-foreground">
                {['Person', 'Role', 'Belongs to', 'Access', 'Last changed'].map((h) => (
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
              {people.map((p) => {
                const pill = accessPill(p.access)
                const inactive = p.status === 'inactive'
                return (
                  <tr key={p.id} className={cn('border-b last:border-b-0', inactive && 'text-muted-foreground')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                          {formatInitials(p)}
                        </span>
                        <span className="min-w-0">
                          <span className="text-body-strong flex items-center gap-1.5">
                            {p.full_name}
                            {inactive && <Pill tone="neutral">Deactivated</Pill>}
                          </span>
                          <span className="text-caption block">{p.email}</span>
                        </span>
                      </div>
                    </td>
                    <td className="text-body px-4 py-3">{ROLE_SHORT_LABELS[p.role] ?? p.role}</td>
                    <td className="text-body px-4 py-3">
                      {p.home_company ? (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> {p.home_company.name}
                        </span>
                      ) : (
                        <span>{p.department ? `${companyName} · ${p.department}` : companyName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={pill.tone}>{pill.text}</Pill>
                    </td>
                    <td className="text-caption px-4 py-3 whitespace-nowrap">
                      {p.access_changed_at ? (
                        <>
                          {formatTimeAgo(p.access_changed_at)}
                          {p.access_by && <span className="block">by {p.access_by}</span>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.access === 'accepted' ? (
                        <button
                          type="button"
                          onClick={() => setRemoving(p)}
                          className="text-body-strong h-[34px] rounded-lg border bg-card px-3 text-danger outline-none hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          Remove access
                        </button>
                      ) : !p.home_company && !inactive ? (
                        <button
                          type="button"
                          onClick={openGrant}
                          className="text-body-strong h-[34px] rounded-lg border bg-card px-3 text-primary outline-none hover:bg-primary-faint focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          Grant access
                        </button>
                      ) : (
                        <span className="text-caption">{inactive ? 'Reactivate first' : '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {list.status === 'success' && meta && meta.total > 0 && (
        <div className="text-caption flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing {meta.from}–{meta.to} of {plural(meta.total, 'person', 'people')}
            {filtered && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show everyone
                </button>
              </>
            )}
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
        {removing && <RemoveAccessDialog key="remove" person={removing} companyName={companyName} onClose={() => setRemoving(null)} />}
      </AnimatePresence>
    </div>
  )
}

function Card({ label, value, icon: Icon, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="text-caption block truncate">{label}</span>
        {value === undefined ? (
          <span className="mt-1 block h-4 w-10 animate-pulse rounded bg-muted" />
        ) : (
          <span className="text-card-title block">{formatNumber(value)}</span>
        )}
      </span>
    </button>
  )
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading company access" className="flex flex-col rounded-xl border bg-card">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          <div className="size-8 animate-pulse rounded-full bg-muted" />
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
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
