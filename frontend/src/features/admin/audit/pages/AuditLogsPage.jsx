import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { format, subDays } from 'date-fns'
import { Activity, AlertTriangle, ChevronDown, ChevronRight, Flag, Lock, ScrollText, Search, SearchX, Users, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, formatInitials, formatNumber, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import AuditEntryPanel from '../components/AuditEntryPanel'
import { useAuditLogs } from '../hooks/useAuditLogs'

/** Date range presets (whole days, today included). "custom" shows two date fields. */
const RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '365d', label: 'Last 12 months', days: 365 },
  { key: 'custom', label: 'Choose dates…' },
]

const ymd = (d) => format(d, 'yyyy-MM-dd')

/**
 * System → Audit logs for an Admin (code-first 2026-11-22). Read-only: entries can't be changed or deleted.
 * Only the Admin's own company, and never voucher activity (the server enforces both).
 * The ADDRESS holds ?group=&q=&range=&from=&to=&sensitive=1&page=&entry={id}.
 */
export default function AuditLogsPage() {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [params, setParams] = useSearchParams()
  const group = params.get('group')
  const search = params.get('q') ?? ''
  const range = params.get('range') ?? '7d'
  const sensitive = params.get('sensitive') === '1'
  const page = Number(params.get('page')) || 1
  const openId = Number(params.get('entry')) || null
  const today = ymd(new Date())

  const dates = useMemo(() => {
    if (range === 'custom') return { from: params.get('from') || null, to: params.get('to') || null }
    const preset = RANGES.find((r) => r.key === range) ?? RANGES[1]
    return { from: ymd(subDays(new Date(), preset.days - 1)), to: null }
  }, [range, params])

  const filters = useMemo(() => ({ search, group, ...dates, sensitive, page }), [search, group, dates, sensitive, page])
  const list = useAuditLogs(filters)

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

  const filtered = Boolean(search || group || sensitive || range !== '7d')
  const clearFilters = () => {
    setSearchText('')
    update({ q: null, group: null, sensitive: null, range: null, from: null, to: null })
  }

  const meta = list.meta
  const summary = meta?.summary
  const groupCounts = meta?.groups ?? {}
  const allCount = Object.values(groupCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Audit logs</h1>
          <p className="text-body text-muted-foreground">Everything done in {companyName}: who did it, when, and what changed.</p>
        </div>
        <span className="text-badge flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" /> Entries can't be changed or deleted
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Events today"
          value={summary?.events_today}
          icon={Activity}
          tone="bg-primary-soft text-primary"
          onClick={() => update({ range: 'today', group: null, sensitive: null })}
        />
        <Card label="People active today" value={summary?.people_today} icon={Users} tone="bg-primary-soft text-primary" />
        <Card
          label="Sensitive actions (7 days)"
          value={summary?.sensitive_7d}
          icon={Flag}
          tone={summary?.sensitive_7d ? 'bg-warning-soft text-warning' : 'bg-muted text-muted-foreground'}
          onClick={() => update({ sensitive: 1, range: null })}
        />
        <Card
          label="Failed sign-ins (7 days)"
          value={summary?.failed_sign_ins_7d}
          icon={AlertTriangle}
          tone={summary?.failed_sign_ins_7d ? 'bg-danger-soft text-danger' : 'bg-muted text-muted-foreground'}
          onClick={() => update({ group: 'security', range: null, sensitive: null })}
        />
      </div>

      <div
        role="tablist"
        aria-label="Kinds of action"
        className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-lg border bg-card p-[3px]"
      >
        {[{ key: null, label: 'All' }, ...(meta?.group_options ?? [])].map((g) => {
          const active = (group ?? null) === g.key
          const count = g.key ? (groupCounts[g.key] ?? 0) : allCount
          return (
            <button
              key={g.key ?? 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => update({ group: g.key })}
              className={cn(
                'flex h-8 shrink-0 items-center rounded-md px-3 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active ? 'text-badge bg-primary-soft text-primary' : 'text-caption hover:bg-muted',
              )}
            >
              {g.label}
              {meta && ` ${formatNumber(count)}`}
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
            maxLength={120}
            placeholder="Search person, email, IP or #id…"
            aria-label="Search the audit log"
            className="text-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <label className="relative">
          <span className="sr-only">Dates</span>
          <select
            value={range}
            onChange={(e) =>
              e.target.value === 'custom'
                ? update({ range: 'custom', from: dates.from ?? ymd(subDays(new Date(), 6)), to: today })
                : update({ range: e.target.value === '7d' ? null : e.target.value, from: null, to: null })
            }
            className="text-body-strong h-[38px] appearance-none rounded-lg border bg-card pr-9 pl-3 outline-none focus:border-primary"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </label>

        {range === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="From"
              value={dates.from ?? ''}
              max={dates.to ?? today}
              onChange={(e) => update({ from: e.target.value })}
              className="text-body h-[38px] rounded-lg border bg-card px-2.5 outline-none focus:border-primary"
            />
            <span className="text-caption">to</span>
            <input
              type="date"
              aria-label="To"
              value={dates.to ?? ''}
              min={dates.from ?? undefined}
              max={today}
              onChange={(e) => update({ to: e.target.value })}
              className="text-body h-[38px] rounded-lg border bg-card px-2.5 outline-none focus:border-primary"
            />
          </div>
        )}

        <label className="text-body-strong flex h-[38px] cursor-pointer items-center gap-2 rounded-lg border bg-card px-3">
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(e) => update({ sensitive: e.target.checked ? 1 : null })}
            className="size-4 accent-primary"
          />
          Sensitive only
        </label>

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

      {list.status === 'loading' && <ListSkeleton />}

      {list.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title={list.error.status === 422 ? 'Check the dates' : "Couldn't load the audit log"}
            message={list.error.errors?.to?.[0] ?? list.error.message}
            requestId={list.error.requestId}
            onRetry={list.error.status === 422 ? undefined : list.reload}
          />
        </div>
      )}

      {list.status === 'success' && list.entries.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={search ? SearchX : ScrollText}
            title={search ? `Nothing matches “${search}”` : 'Nothing recorded for these filters'}
            description={
              filtered ? 'Try a longer date range, or clear the filters.' : `Nothing has happened in ${companyName} in the last 7 days.`
            }
            action={
              filtered && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Clear filters
                </button>
              )
            }
          />
        </div>
      )}

      {list.status === 'success' && list.entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="text-table-head border-b bg-muted text-muted-foreground">
                {['Time', 'Who', 'Action', 'Record', 'IP address'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2.5">
                    {h}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.entries.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => update({ entry: e.id }, { keepPage: true })}
                  className={cn('cursor-pointer border-b last:border-b-0 hover:bg-primary-faint', openId === e.id && 'bg-primary-faint')}
                >
                  <td className="text-caption px-4 py-3 whitespace-nowrap">
                    <span className="block text-foreground">{formatDate(e.at, 'h:mm a')}</span>
                    {formatDate(e.at, 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-badge flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        {e.who.kind === 'person' ? formatInitials(e.who) : '·'}
                      </span>
                      <span className="min-w-0">
                        <span className="text-body-strong block">
                          {e.who.name}
                          {e.who.is_you && <span className="text-caption"> (you)</span>}
                        </span>
                        {e.who.role && <span className="text-caption block">{e.who.role}</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Pill tone={e.action.tone}>{e.action.label}</Pill>
                      {e.action.sensitive && <Flag className="size-3.5 shrink-0 text-warning" aria-label="Sensitive" />}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-body block max-w-[260px] truncate">{e.record.title}</span>
                    {e.record.subtitle && <span className="text-caption block max-w-[260px] truncate">{e.record.subtitle}</span>}
                  </td>
                  <td className="text-caption px-4 py-3 font-mono">{e.ip ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      aria-label={`Open the details of ${e.action.label}`}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        update({ entry: e.id }, { keepPage: true })
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.status === 'success' && meta && meta.total > 0 && (
        <div className="text-caption flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing {meta.from}–{meta.to} of {plural(meta.total, 'entry', 'entries')}
            {meta.range?.from && ` since ${formatDate(meta.range.from, 'MMM d, yyyy')}`}
          </p>
          {meta.last_page > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-2">
              <PagerButton
                disabled={meta.current_page <= 1}
                onClick={() => update({ page: meta.current_page - 1 > 1 ? meta.current_page - 1 : null }, { keepPage: true })}
              >
                ‹ Newer
              </PagerButton>
              <span aria-current="page">
                Page {meta.current_page} of {meta.last_page}
              </span>
              <PagerButton
                disabled={meta.current_page >= meta.last_page}
                onClick={() => update({ page: meta.current_page + 1 }, { keepPage: true })}
              >
                Older ›
              </PagerButton>
            </nav>
          )}
        </div>
      )}

      <AnimatePresence>
        {openId && <AuditEntryPanel key={`entry-${openId}`} id={openId} onClose={() => update({ entry: null }, { keepPage: true })} />}
      </AnimatePresence>
    </div>
  )
}

function Card({ label, value, icon: Icon, tone, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left',
        onClick && 'outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
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
    </Tag>
  )
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading the audit log" className="flex flex-col rounded-xl border bg-card">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="size-7 animate-pulse rounded-full bg-muted" />
          <div className="h-3.5 w-1/5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-1/5 animate-pulse rounded bg-muted" />
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
