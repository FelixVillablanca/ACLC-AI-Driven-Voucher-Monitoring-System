import { useEffect, useState } from 'react'
import { Copy, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import WhatChanged from '@/components/common/WhatChanged'
import { formatDate } from '@/lib/formatters'
import { getAuditEntry } from '../api'

const INTEGRITY = {
  intact: { icon: ShieldCheck, tone: 'bg-success-soft text-success', text: 'Untouched since it was written' },
  changed: {
    icon: ShieldAlert,
    tone: 'bg-danger-soft text-danger',
    text: 'This entry was changed after it was written. Tell a Super Admin.',
  },
  not_sealed: {
    icon: ShieldQuestion,
    tone: 'bg-muted text-muted-foreground',
    text: 'Written before entries were sealed, so it can’t be checked.',
  },
}

/** One audit entry in a side panel (?entry={id}): who, what, what changed, where from, and the tamper check. */
export default function AuditEntryPanel({ id, onClose }) {
  const [state, setState] = useState({ id: null, status: 'loading', entry: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    getAuditEntry(id)
      .then((entry) => alive && setState({ id: `${id}|${attempt}`, status: 'success', entry, error: null }))
      .catch((error) => alive && setState({ id: `${id}|${attempt}`, status: 'error', entry: null, error }))
    return () => {
      alive = false
    }
  }, [id, attempt])

  const current = state.id === `${id}|${attempt}`
  const status = current ? state.status : 'loading'
  const e = current ? state.entry : null
  const integrity = e && INTEGRITY[e.integrity]

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error("Couldn't copy the link.")
    }
  }

  return (
    <SidePanel
      label="Audit entry"
      width={480}
      onClose={onClose}
      footer={
        e && (
          <button
            type="button"
            onClick={copyLink}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Copy className="size-4" aria-hidden="true" /> Copy link
          </button>
        )
      }
    >
      <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          {e ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={e.action.tone}>{e.action.label}</Pill>
                {e.action.sensitive && <Pill tone="warning">⚑ Sensitive</Pill>}
              </div>
              <p className="text-card-title mt-1.5">{e.record.title}</p>
              <p className="text-caption">{formatDate(e.at, 'EEEE, MMMM d, yyyy · h:mm:ss a')}</p>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          )}
        </div>
        <PanelClose onClick={onClose} />
      </div>

      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 p-12">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the entry…</span>
        </div>
      )}

      {status === 'error' && (
        <ErrorState
          title={state.error?.status === 404 ? 'Entry not found' : "Couldn't load the entry"}
          message={state.error?.status === 404 ? "It isn't part of your company's audit log." : state.error?.message}
          requestId={state.error?.requestId}
          onRetry={state.error?.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
        />
      )}

      {e && (
        <div className="flex flex-col gap-5 px-6 py-5">
          {e.note && <p className="text-caption rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-foreground">{e.note}</p>}

          <Section title="Done by">
            <p className="text-body-strong">
              {e.who.name}
              {e.who.is_you && <span className="text-caption"> (you)</span>}
            </p>
            <p className="text-caption">{[e.who.role, e.who.email].filter(Boolean).join(' · ')}</p>
          </Section>

          <Section title="What changed">
            <WhatChanged changes={e.changes} />
          </Section>

          <Section title="Where from">
            <dl className="text-caption grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
              <dt>IP address</dt>
              <dd className="font-mono text-foreground">{e.ip ?? '—'}</dd>
              <dt>Browser</dt>
              <dd className="text-foreground">{e.browser ?? '—'}</dd>
              <dt>Record</dt>
              <dd className="font-mono text-foreground">{e.record.subtitle ?? '—'}</dd>
              <dt>Request ID</dt>
              <dd className="font-mono break-all text-foreground">{e.request_id ?? '—'}</dd>
            </dl>
          </Section>

          {integrity && (
            <div className={`flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 ${integrity.tone}`}>
              <integrity.icon className="size-4 shrink-0" aria-hidden="true" />
              <p className="text-caption text-current">{integrity.text}</p>
            </div>
          )}
        </div>
      )}
    </SidePanel>
  )
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-table-head text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}
