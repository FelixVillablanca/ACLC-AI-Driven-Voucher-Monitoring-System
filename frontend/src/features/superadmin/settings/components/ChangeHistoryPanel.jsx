import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, History, Loader2, RotateCcw, Settings2, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatDate, formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { listSettingsHistory } from '../api'
import { GROUP_TAGS, settingLabel, showValue } from '../utils'

const TABS = [{ key: null, label: 'All' }, ...Object.entries(GROUP_TAGS).map(([key, t]) => ({ key, label: t.label }))]

/**
 * "Change history" (G1, frame OtA4G9A9F): a 460px panel from the right with every SAVED change to
 * the global settings, newest first, from the audit log. Filter tabs per section with counts,
 * "Load older changes", and "↺ Restore …" on a setting's newest change while it's still the live
 * value: Restore only puts the old value back in the form (you still Save it, with your password).
 *   onRestore(key, value)
 * Render it inside <AnimatePresence> while open.
 */
export default function ChangeHistoryPanel({ onClose, onRestore }) {
  const me = useAuthStore((s) => s.user)
  const [group, setGroup] = useState(null)
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null, more: false })

  const fetchInto = useCallback(
    (forGroup, page) =>
      listSettingsHistory({ group: forGroup, page })
        .then(({ items, meta }) =>
          setState((prev) => ({
            status: 'success',
            items: page === 1 ? items : [...prev.items, ...items],
            meta,
            error: null,
            more: false,
          })),
        )
        .catch((error) =>
          setState((prev) =>
            page === 1 ? { status: 'error', items: [], meta: null, error, more: false } : { ...prev, error, more: false },
          ),
        ),
    [],
  )

  // first load (the state already starts at 'loading')
  useEffect(() => {
    fetchInto(null, 1)
  }, [fetchInto])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickGroup = (key) => {
    setGroup(key)
    setState((prev) => ({ ...prev, status: 'loading', items: [], error: null }))
    fetchInto(key, 1)
  }
  const retry = () => pickGroup(group)
  const loadMore = () => {
    setState((prev) => ({ ...prev, more: true, error: null }))
    fetchInto(group, state.meta.current_page + 1)
  }

  const counts = state.meta?.counts
  const hasMore = Boolean(state.meta && state.meta.current_page < state.meta.last_page)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-foreground/45"
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-history-title"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card text-foreground shadow-2xl sm:w-[460px]"
      >
        <header className="flex flex-col gap-3.5 border-b px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 id="settings-history-title" className="text-page-title">
                Change history
              </h2>
              <p className="text-caption">Every saved change to global settings, newest first. Unsaved edits don’t show here.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div role="tablist" aria-label="Filter by section" className="flex h-[34px] gap-0.5 rounded-lg border bg-muted p-[3px]">
            {TABS.map((t) => {
              const on = group === t.key
              const count = counts ? counts[t.key ?? 'all'] : null
              return (
                <button
                  key={t.label}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => !on && pickGroup(t.key)}
                  className={cn(
                    'flex-1 rounded-md px-1.5 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    on ? 'text-badge bg-card text-primary shadow-sm' : 'text-caption hover:text-foreground',
                  )}
                >
                  {t.label}
                  {t.key === null && count != null && ` ${count}`}
                </button>
              )
            })}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-2">
          {state.status === 'loading' && (
            <div role="status" className="flex flex-1 items-center justify-center gap-2 py-10">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              <span className="text-caption">Loading the history…</span>
            </div>
          )}
          {state.status === 'error' && (
            <ErrorState
              title="Couldn't load the change history"
              message={state.error.message}
              requestId={state.error.requestId}
              onRetry={retry}
            />
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <EmptyState
              icon={History}
              title={group ? `No ${GROUP_TAGS[group].label} changes yet` : 'No changes yet'}
              description="Saved changes appear here, with who made them and why."
            />
          )}

          {state.items.length > 0 && (
            <ol className="flex flex-col">
              {state.items.map((e) => (
                <Entry key={e.id} entry={e} me={me} onRestore={onRestore} />
              ))}
            </ol>
          )}

          {(hasMore || (state.error && state.items.length > 0)) && (
            <div className="flex flex-col items-center gap-1.5 py-3">
              {state.error && state.items.length > 0 && (
                <p role="alert" className="text-caption text-danger">
                  Couldn’t load more: {state.error.message}
                </p>
              )}
              <button
                type="button"
                disabled={state.more}
                onClick={loadMore}
                className="text-body-strong flex h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                {state.more && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {state.error ? 'Try again' : 'Load older changes'}
              </button>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-6 py-3.5">
          <p className="text-caption">
            {state.meta ? `Showing ${state.items.length} of ${plural(state.meta.total, 'change', 'changes')}` : ' '}
          </p>
          <Link
            to={PATHS.SUPERADMIN_AUDIT_LOGS}
            className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Open full audit log →
          </Link>
        </footer>
      </motion.aside>
    </motion.div>
  )
}

function Entry({ entry: e, me, onRestore }) {
  const when = `${formatDate(e.at, 'MMM d')} · ${formatDate(e.at, 'h:mm a')}`

  if (e.action === 'defaults_applied') {
    return (
      <li className="flex gap-3 border-b py-4 last:border-b-0">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          <Settings2 className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Who name="System" when={when} at={e.at} />
          <p className="text-body">Platform defaults applied</p>
          <p className="text-caption">
            Starting values for {plural(e.defaults?.length ?? 0, 'setting', 'settings')}
            {e.defaults?.length ? `: ${e.defaults.map(settingLabel).join(', ')}` : ''}.
          </p>
        </div>
      </li>
    )
  }

  const tag = GROUP_TAGS[e.group]
  const isMe = e.by && me && e.by.id === me.id
  return (
    <li className="flex gap-3 border-b py-4 last:border-b-0">
      <span
        aria-hidden="true"
        className={cn(
          'text-badge flex size-8 shrink-0 items-center justify-center rounded-full',
          isMe ? 'bg-primary text-primary-foreground' : 'bg-hero-amber-soft text-warning',
        )}
      >
        {e.by ? formatInitials(e.by) : '?'}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Who name={e.by ? `${e.by.full_name}${isMe ? ' (you)' : ''}` : 'A removed account'} when={when} at={e.at} />
        <div className="flex flex-wrap items-center gap-1.5">
          {tag && <Pill tone={tag.tone}>{tag.label}</Pill>}
          <span className="text-body">{settingLabel(e.key)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-caption rounded-md border bg-muted px-2 py-0.5">{showValue(e.key, e.old)}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-label="changed to" />
          <span className="text-badge rounded-md bg-success-soft px-2 py-0.5 text-success">{showValue(e.key, e.new)}</span>
        </div>
        {e.reason && <p className="text-caption break-words">“{e.reason}”</p>}
        {e.can_restore && (
          <button
            type="button"
            onClick={() => onRestore(e.key, e.old)}
            className="text-auth-link flex items-center gap-1 self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" /> Restore {showValue(e.key, e.old)}
          </button>
        )}
      </div>
    </li>
  )
}

function Who({ name, when, at }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-body-strong">{name}</span>
      <time className="text-caption" dateTime={at}>
        {when}
      </time>
    </div>
  )
}
