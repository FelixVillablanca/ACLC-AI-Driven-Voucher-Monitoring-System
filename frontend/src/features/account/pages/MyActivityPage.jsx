import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Flag, History, Loader2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { formatNumber, formatSignInTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { getActivity } from '../api'
import AccountPageShell from '../components/AccountPageShell'
import { ACTIVITY_FILTERS, TONE_DOT, accountLinks, buttonClass } from '../utils'

/**
 * My activity (no Framer frame, code-first): your own audit log entries, newest first.
 * Filter (?type=all|security|changes) and page (?page=2) live in the address, so Back and
 * refresh keep them. Read-only: entries can't be edited or deleted (append-only audit log).
 */
export default function MyActivityPage() {
  const role = useAuthStore((s) => s.user?.role)
  const links = accountLinks(role)
  const [params, setParams] = useSearchParams()
  const type = ACTIVITY_FILTERS.some((f) => f.key === params.get('type')) ? params.get('type') : 'all'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const key = `${type}|${page}`
  // `key` = which filter + page the shown data belongs to; a different one means "loading the new one"
  const [state, setState] = useState({ status: 'loading', data: null, error: null, key: null })

  const load = useCallback(
    () =>
      getActivity({ type, page })
        .then((data) => setState({ status: 'success', data, error: null, key: `${type}|${page}` }))
        .catch((error) => setState((prev) => ({ status: 'error', data: prev.data, error, key: `${type}|${page}` }))),
    [type, page],
  )
  useEffect(() => {
    load()
  }, [load])

  const go = (next) =>
    setParams((p) => {
      Object.entries(next).forEach(([k, v]) => (v && v !== 'all' && !(k === 'page' && v === 1) ? p.set(k, String(v)) : p.delete(k)))
      return p
    })

  const data = state.data
  const loadingAgain = Boolean(data) && state.key !== key

  return (
    <AccountPageShell
      title="My activity"
      description="Everything you did in the system, and every sign-in to your account. Entries can’t be edited or deleted."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sign-ins · 30 days" value={data?.summary.sign_ins_30d} />
        <Stat
          label="Failed sign-ins · 30 days"
          value={data?.summary.failed_30d}
          tone={data?.summary.failed_30d ? 'danger' : null}
          hint={data?.summary.failed_30d ? 'Not you? Change your password.' : null}
          to={data?.summary.failed_30d ? links.changePassword : null}
        />
        <Stat label="Changes you made · 30 days" value={data?.summary.changes_30d} />
      </div>

      <section className="flex flex-col rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
          <div role="tablist" aria-label="Show" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={type === f.key}
                onClick={() => go({ type: f.key, page: 1 })}
                className={cn(
                  'text-body-strong h-8 rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  type === f.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {data && <p className="text-caption">{data.meta.total ? `${formatNumber(data.meta.total)} entries` : ''}</p>}
        </div>

        {!data && state.status !== 'error' && (
          <p role="status" className="text-caption flex items-center justify-center gap-2 py-16">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" /> Loading your activity…
          </p>
        )}
        {state.status === 'error' && !loadingAgain && (
          <ErrorState title="Couldn't load your activity" message={state.error.message} requestId={state.error.requestId} onRetry={load} />
        )}
        {data && state.status !== 'error' && data.data.length === 0 && (
          <EmptyState
            icon={History}
            title={type === 'all' ? 'Nothing recorded yet' : 'Nothing of this kind yet'}
            description={type === 'all' ? 'Your sign-ins and changes will appear here.' : 'Try “All” to see everything.'}
          />
        )}
        {data && state.status !== 'error' && data.data.length > 0 && (
          <ol className={cn('flex flex-col', loadingAgain && 'opacity-60')} aria-busy={loadingAgain || undefined}>
            {data.data.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-t px-5 py-3 first:border-t-0">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_DOT[entry.tone] ?? TONE_DOT.neutral)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong flex flex-wrap items-center gap-1.5">
                    {entry.text}
                    {entry.sensitive && (
                      <span className="text-badge inline-flex items-center gap-0.5 text-warning" title="Sensitive action">
                        <Flag className="size-3" aria-hidden="true" />
                        <span className="sr-only">Sensitive</span>
                      </span>
                    )}
                  </p>
                  <p className="text-caption">{[entry.label, entry.device, entry.ip_address].filter(Boolean).join(' · ')}</p>
                </div>
                <time dateTime={entry.at} className="text-caption shrink-0 text-right">
                  {formatSignInTime(entry.at)}
                </time>
              </li>
            ))}
          </ol>
        )}

        {data && data.meta.last_page > 1 && (
          <div className="flex items-center justify-between gap-2 border-t bg-muted px-5 py-3">
            <p className="text-caption">
              Page {data.meta.current_page} of {data.meta.last_page}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go({ type, page: page - 1 })}
                disabled={page <= 1 || loadingAgain}
                className={buttonClass.secondary}
              >
                <ChevronLeft className="size-4" aria-hidden="true" /> Newer
              </button>
              <button
                type="button"
                onClick={() => go({ type, page: page + 1 })}
                disabled={page >= data.meta.last_page || loadingAgain}
                className={buttonClass.secondary}
              >
                Older <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="text-caption">
        See something you don’t recognise?{' '}
        <Link to={links.changePassword} className="text-primary hover:underline">
          Change your password
        </Link>{' '}
        and{' '}
        <Link to={links.settings} className="text-primary hover:underline">
          sign out your other devices
        </Link>
        .
      </p>
    </AccountPageShell>
  )
}

function Stat({ label, value, tone, hint, to }) {
  return (
    <div className={cn('flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5', tone === 'danger' && 'border-danger/25')}>
      <p className="text-caption">{label}</p>
      <p className={cn('text-stat-value', tone === 'danger' && 'text-danger')}>{value === undefined ? '—' : formatNumber(value)}</p>
      {hint &&
        (to ? (
          <Link to={to} className="text-caption text-primary hover:underline">
            {hint}
          </Link>
        ) : (
          <p className="text-caption">{hint}</p>
        ))}
    </div>
  )
}
