import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Crown, Layers, Plus, Search, SearchX, UserX, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { useDebounce } from '@/hooks/useDebounce'
import { formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import DepartmentPanel from '../components/DepartmentPanel'
import DepartmentStatusDialog from '../components/DepartmentStatusDialog'
import DepartmentsTable from '../components/DepartmentsTable'
import EditDepartmentModal from '../components/EditDepartmentModal'
import { useDepartments } from '../hooks/useDepartments'
import { CREATE_DEPARTMENT_SEARCH, SORTS, VIEWS } from '../utils'

/**
 * Organization → Departments (code-first 2026-11-22). Only the Admin's own company.
 *
 * The ADDRESS holds the view, search, sort, page and the open side panel
 * (?view=no_head&q=fin&sort=people&page=2&department=12), so Back, refresh and a shared link
 * show the same thing. "+ Add department" opens the shared modal (?create=department).
 */
export default function DepartmentsPage() {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [params, setParams] = useSearchParams()
  const view = params.get('view')
  const search = params.get('q') ?? ''
  const sort = params.get('sort') ?? 'name'
  const page = Number(params.get('page')) || 1
  const openId = Number(params.get('department')) || null

  const list = useDepartments({ view, search, sort: sort === 'name' ? undefined : sort, page })
  const [dialog, setDialog] = useState(null) // { type: 'edit' | 'status', department }

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

  const clearFilters = () => {
    setSearchText('')
    update({ q: null, view: null })
  }

  const onAction = (type, department) => {
    if (type === 'open') update({ department: department.id }, { keepPage: true })
    else setDialog({ type, department })
  }

  const closePanel = useCallback(() => update({ department: null }, { keepPage: true }), [update])
  const openAdd = () => update({ create: CREATE_DEPARTMENT_SEARCH.split('=')[1] }, { keepPage: true })

  const meta = list.meta
  const departments = list.departments

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Departments</h1>
          <p className="text-body text-muted-foreground">The departments of {companyName}. People are put in one when you create them.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" /> Add department
        </button>
      </div>

      <SummaryCards summary={meta?.summary} onNoHead={() => update({ view: 'no_head' })} />

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
              placeholder="Search departments…"
              aria-label="Search departments by name, code or head"
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

      {list.status === 'loading' && <TableSkeleton />}

      {list.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the departments"
            message={list.error.message}
            requestId={list.error.requestId}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.status === 'success' && departments.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={search || view ? SearchX : Layers}
            title={
              search
                ? `No department matches “${search}”`
                : view === 'no_head'
                  ? 'Every active department has a head'
                  : view === 'inactive'
                    ? 'No deactivated departments'
                    : view
                      ? 'No departments in this view'
                      : 'No departments yet'
            }
            description={
              search
                ? 'Try another name, code or head.'
                : view
                  ? 'Show all departments to see the others.'
                  : `Add the first department of ${companyName}, then put people in it when you create them.`
            }
            action={
              search || view ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show all departments
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openAdd}
                  className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Plus className="size-4" aria-hidden="true" /> Add department
                </button>
              )
            }
          />
        </div>
      )}

      {list.status === 'success' && departments.length > 0 && <DepartmentsTable departments={departments} onAction={onAction} />}

      {list.status === 'success' && meta && meta.total > 0 && (
        <div className="text-caption flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing {meta.from}–{meta.to} of {plural(meta.total, 'department', 'departments')}
            {(search || view) && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Show all
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
        {openId && <DepartmentPanel key={`panel-${openId}`} id={openId} onClose={closePanel} onAction={onAction} />}
      </AnimatePresence>
      <AnimatePresence>
        {dialog?.type === 'edit' && <EditDepartmentModal key="edit" department={dialog.department} onClose={() => setDialog(null)} />}
        {dialog?.type === 'status' && (
          <DepartmentStatusDialog key="status" department={dialog.department} onClose={() => setDialog(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function SummaryCards({ summary, onNoHead }) {
  const cards = [
    { label: 'Departments', value: summary?.total, icon: Layers, tone: 'bg-primary-soft text-primary' },
    { label: 'Active', value: summary?.active, icon: Layers, tone: 'bg-success-soft text-success' },
    {
      label: 'Without a head',
      value: summary?.without_head,
      icon: Crown,
      tone: summary?.without_head ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
      onClick: summary?.without_head ? onNoHead : undefined,
    },
    {
      label: 'People without a department',
      value: summary?.people_without_department,
      icon: UserX,
      tone: summary?.people_without_department ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => {
        const Tag = c.onClick ? 'button' : 'div'
        return (
          <Tag
            key={c.label}
            {...(c.onClick ? { type: 'button', onClick: c.onClick } : {})}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left',
              c.onClick && 'outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
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
          </Tag>
        )
      })}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading departments" className="flex flex-col rounded-xl border bg-card">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-1/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-1/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-8 animate-pulse rounded bg-muted" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
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
