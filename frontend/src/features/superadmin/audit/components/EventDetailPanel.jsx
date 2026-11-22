import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Flag, Loader2, Lock, ShieldAlert, ShieldQuestion, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import { PATHS } from '@/lib/constants'
import { formatDate, formatInitials } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getAuditEntry } from '../api'
import { TONE_PILL } from '../utils'
import WhatChanged from '@/components/common/WhatChanged'

/**
 * Event details (AL7, frame cY8zDqTvU): a 480px panel from the right with who did it, what changed,
 * where it came from (IP, browser, request ID), the TAMPER CHECK (its fingerprint still matches?),
 * the other entries of the same request, and links: Copy link · open the person / company.
 * The page keeps it in the address (?event=48213), so "Copy link" shares exactly this entry.
 *   onMoreFromPerson(entry) = filter the table to that person on that day
 */
export default function EventDetailPanel({ eventId, onClose, onMoreFromPerson }) {
  return (
    <AnimatePresence>
      {eventId && <Panel key={eventId} eventId={eventId} onClose={onClose} onMoreFromPerson={onMoreFromPerson} />}
    </AnimatePresence>
  )
}

function Panel({ eventId, onClose, onMoreFromPerson }) {
  const [state, setState] = useState({ status: 'loading', entry: null, error: null })

  const fetchEntry = useCallback(
    () =>
      getAuditEntry(eventId)
        .then((entry) => setState({ status: 'success', entry, error: null }))
        .catch((error) => setState({ status: 'error', entry: null, error })),
    [eventId],
  )

  useEffect(() => {
    fetchEntry() // starts at 'loading': the panel mounts fresh for each event (key)
  }, [fetchEntry])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const retry = () => {
    setState({ status: 'loading', entry: null, error: null })
    fetchEntry()
  }

  const e = state.entry

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied. It opens this entry for any Super Admin.')
    } catch {
      toast.error('Couldn’t copy the link. Copy it from the address bar instead.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-foreground/45"
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Event details"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card text-foreground shadow-2xl sm:w-[480px]"
      >
        {state.status === 'loading' && (
          <div role="status" className="flex flex-1 items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading the event…</span>
          </div>
        )}
        {state.status === 'error' && (
          <div className="flex flex-1 flex-col">
            <div className="flex justify-end p-3">
              <CloseButton onClick={onClose} />
            </div>
            <ErrorState
              title={state.error.status === 404 ? 'This entry doesn’t exist' : "Couldn't load this event"}
              message={state.error.status === 404 ? 'Check the link: the number may be wrong.' : state.error.message}
              requestId={state.error.requestId}
              onRetry={state.error.status === 404 ? undefined : retry}
            />
          </div>
        )}

        {e && (
          <>
            <header className="flex flex-col gap-2 border-b px-6 pt-5 pb-4">
              <div className="flex items-center gap-2">
                <span className={cn('text-badge rounded-full px-2 py-0.5', TONE_PILL[e.action.tone])}>{e.action.label}</span>
                {e.action.sensitive && (
                  <span className="text-badge flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                    <Flag className="size-3" aria-hidden="true" /> Sensitive
                  </span>
                )}
                <span className="ml-auto">
                  <CloseButton onClick={onClose} />
                </span>
              </div>
              <h2 className="text-card-title text-base">
                {e.who.name}
                {e.who.is_you && ' (you)'} · {e.record.title}
              </h2>
              <p className="text-caption">{formatDate(e.at, 'MMM d, yyyy · h:mm:ss a')} (Manila time)</p>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              <Section title="Done by">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="text-badge flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                  >
                    {e.who.kind === 'person' ? formatInitials(e.who) : e.who.kind === 'unknown' ? '?' : 'SY'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-body-strong truncate">{e.who.name}</p>
                    <p className="text-caption truncate">{[e.who.role, e.who.email].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
              </Section>

              <Section title={`What changed${e.record.subtitle ? ` · ${e.record.subtitle}` : ''}`}>
                <WhatChanged changes={e.changes} />
                {e.note && <p className="text-caption">⚑ {e.note}</p>}
              </Section>

              <Section title="Where it came from">
                <dl className="flex flex-col gap-1.5 rounded-[10px] bg-muted px-3.5 py-3">
                  <Fact label="IP address">{e.ip ?? 'None (done by the system)'}</Fact>
                  <Fact label="Browser">{e.browser ?? 'Not recorded'}</Fact>
                  <Fact label="Request ID">{e.request_id ?? 'Not recorded'}</Fact>
                  <Fact label="Company">{e.company?.name ?? 'Platform-wide'}</Fact>
                </dl>
              </Section>

              <Integrity status={e.integrity} id={e.id} />

              {(e.same_request.length > 0 || e.more_from_person_that_day > 0) && (
                <Section title="Same request">
                  {e.same_request.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {e.same_request.map((r) => (
                        <li key={r.id} className="text-body">
                          • {r.label} <span className="text-caption">(entry #{r.id})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-caption">Nothing else happened in the same click.</p>
                  )}
                  {e.more_from_person_that_day > 0 && (
                    <button
                      type="button"
                      onClick={() => onMoreFromPerson(e)}
                      className="text-auth-link self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      More from {e.who.name} that day ({e.more_from_person_that_day}) →
                    </button>
                  )}
                </Section>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-6 py-3.5">
              <button
                type="button"
                onClick={copyLink}
                className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Copy className="size-4" aria-hidden="true" /> Copy link
              </button>
              {e.target?.type === 'admin' && (
                <Link
                  to={`${PATHS.SUPERADMIN_ADMINS}?profile=${e.target.id}`}
                  className="text-auth-button flex h-[38px] items-center rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  View {e.record.title}’s profile →
                </Link>
              )}
              {e.target?.type === 'company' && (
                <Link
                  to={`${PATHS.SUPERADMIN_COMPANIES}?company=${e.target.id}`}
                  className="text-auth-button flex h-[38px] items-center rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Open {e.record.title} →
                </Link>
              )}
            </footer>
          </>
        )}
      </motion.aside>
    </motion.div>
  )
}

/** The tamper check: does the entry's fingerprint still match what's stored? */
function Integrity({ status, id }) {
  if (status === 'intact') {
    return (
      <div className="flex items-start gap-2.5 rounded-[10px] border border-success/20 bg-success-soft px-3.5 py-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-caption">
          <span className="text-badge block text-success">Untouched since it was written</span>
          Entry #{id.toLocaleString()}. Its fingerprint matches, so nobody has edited it.
        </p>
      </div>
    )
  }
  if (status === 'changed') {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft px-3.5 py-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="text-caption">
          <span className="text-badge block text-danger">Changed after it was written</span>
          Entry #{id.toLocaleString()}. Its fingerprint doesn’t match any more: someone edited this row directly in the database.
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border bg-muted px-3.5 py-3">
      <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="text-caption">
        <span className="text-body-strong block text-foreground">Can’t be checked</span>
        Entry #{id.toLocaleString()} was written before fingerprints were added, so there’s nothing to compare it with.
      </p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-table-head text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-caption shrink-0">{label}</dt>
      <dd className="text-body min-w-0 text-right break-all">{children}</dd>
    </div>
  )
}

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}
