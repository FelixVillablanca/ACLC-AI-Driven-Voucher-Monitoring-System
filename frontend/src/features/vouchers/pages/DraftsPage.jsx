import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { FilePen, Info, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import { PATHS } from '@/lib/constants'
import { formatMoney, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { deleteDraft, deleteDrafts, listVouchers } from '../api'
import DraftCard from '../components/DraftCard'
import { announceVouchersChanged, DRAFT_DAYS, VOUCHERS_CHANGED_EVENT } from '../utils'

const createClass =
  'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50'
const outlineClass =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50'

/**
 * Drafts (/clerk/drafts; Framer Xfr2PEq2q list, nxFtnDIl1 delete confirm, EfNUcqRK0 empty).
 * The clerk's unsubmitted vouchers in the active company as cards, newest change first, 20 a page (?page=).
 * "Select" switches to Select mode: tick cards, then delete them together (all or nothing on the server).
 * Drafts with no change for 30 days are deleted by a nightly job; the cards warn 3 days before.
 */
export default function DraftsPage() {
  const [params, setParams] = useSearchParams()
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const page = Number(params.get('page')) || 1

  const key = JSON.stringify([companyId, page])
  const [state, setState] = useState({ key: null, status: 'loading', drafts: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef(0)

  useEffect(() => {
    const id = ++requestRef.current
    const load = (quiet) =>
      listVouchers({ view: 'draft', page })
        .then(({ vouchers, meta }) => id === requestRef.current && setState({ key, status: 'success', drafts: vouchers, meta, error: null }))
        .catch((error) => id === requestRef.current && !quiet && setState((p) => ({ ...p, key, status: 'error', error })))
    load(false)
    const onChanged = () => load(true)
    window.addEventListener(VOUCHERS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(VOUCHERS_CHANGED_EVENT, onChanged)
  }, [key, page, attempt])

  const status = state.key === key ? state.status : 'loading'
  const { drafts, meta } = state

  // a page emptied by deleting → step back one page
  useEffect(() => {
    if (status === 'success' && drafts.length === 0 && page > 1) setParams({ page: String(page - 1) }, { replace: true })
  }, [status, drafts.length, page, setParams])

  // Select mode
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const visibleIds = drafts.map((d) => d.id)
  const chosen = visibleIds.filter((id) => picked.has(id))
  const stopSelecting = () => {
    setSelecting(false)
    setPicked(new Set())
  }
  const toggle = (id) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // delete: { drafts: [..] } for one or several
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const askDelete = (list) => {
    setError(null)
    setConfirm(list)
  }

  const doDelete = async () => {
    const list = confirm
    setBusy(true)
    setError(null)
    try {
      if (list.length === 1) await deleteDraft(list[0].id, list[0].updated_at)
      else await deleteDrafts(list.map((d) => d.id))
      toast.success(list.length === 1 ? 'Draft deleted.' : `${list.length} drafts deleted.`)
      setConfirm(null)
      stopSelecting()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
      announceVouchersChanged() // the list, sidebar and dashboard counts reload (also after a 409: shows what changed)
    }
  }

  const goTo = (n) => setParams(n > 1 ? { page: String(n) } : {}, { replace: true })
  const hasDrafts = status === 'success' && drafts.length > 0

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Drafts</h1>
          <p className="text-body text-muted-foreground">
            Vouchers you started but haven’t submitted{hasDrafts && ' · auto-saved every 30 seconds while you edit'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasDrafts &&
            (selecting ? (
              <button type="button" onClick={stopSelecting} className={outlineClass}>
                <X className="size-4" aria-hidden="true" /> Done
              </button>
            ) : (
              <button type="button" onClick={() => setSelecting(true)} className={outlineClass}>
                <span aria-hidden="true" className="size-3.5 rounded-[3px] border-[1.5px] border-current" /> Select
              </button>
            ))}
          <Link to={PATHS.CLERK_VOUCHER_NEW} className={createClass}>
            <Plus className="size-4" aria-hidden="true" /> Create voucher
          </Link>
        </div>
      </div>

      {hasDrafts && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-primary-soft bg-primary-faint px-3.5 py-2.5">
          <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-body">
            Drafts are private to you and are deleted automatically after {DRAFT_DAYS} days without changes. You’ll get a reminder 3
            days before.
          </p>
        </div>
      )}

      {selecting && hasDrafts && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border bg-card px-4 py-2.5" role="region" aria-label="Selected drafts">
          <p className="text-body-strong">{chosen.length ? `${chosen.length} selected` : 'Tick the drafts to delete'}</p>
          <button
            type="button"
            onClick={() => setPicked(chosen.length === visibleIds.length ? new Set() : new Set(visibleIds))}
            className="text-auth-link text-primary hover:underline"
          >
            {chosen.length === visibleIds.length ? 'Clear' : `Select all ${visibleIds.length}`}
          </button>
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => askDelete(drafts.filter((d) => picked.has(d.id)))}
            className="text-auth-button ml-auto flex h-[34px] items-center gap-1.5 rounded-lg bg-danger px-3.5 text-white outline-none hover:bg-danger/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Delete {chosen.length > 0 ? chosen.length : ''}
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div role="status" aria-label="Loading drafts" className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
              <div className="h-[34px] w-full animate-pulse rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load your drafts"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'success' && drafts.length === 0 && page === 1 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 pt-[72px] pb-[76px] text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft">
            <FilePen className="size-7 text-primary" aria-hidden="true" />
          </div>
          <p className="text-card-title">No drafts right now</p>
          <p className="text-body max-w-md text-muted-foreground">
            When you save a voucher without submitting, it will appear here so you can finish it later.
          </p>
          <Link to={PATHS.CLERK_VOUCHER_NEW} className={createClass}>
            <Plus className="size-4" aria-hidden="true" /> {meta?.counts?.all > 0 ? 'Create voucher' : 'Create your first voucher'}
          </Link>
        </div>
      )}

      {hasDrafts && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              selecting={selecting}
              selected={picked.has(d.id)}
              onToggle={toggle}
              onDelete={(draft) => askDelete([draft])}
            />
          ))}
        </div>
      )}

      {hasDrafts && meta && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[10px] border bg-card px-4 py-3">
          <p className="text-body">
            {plural(meta.total, 'draft', 'drafts')} · {formatMoney(meta.total_amount)} not yet submitted
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {meta.last_page > 1 && (
              <nav aria-label="Pages" className="text-caption flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goTo(page - 1)}
                  className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
                >
                  ‹
                </button>
                <span aria-current="page">
                  Page {meta.current_page} of {meta.last_page}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.last_page}
                  onClick={() => goTo(page + 1)}
                  className="text-body-strong h-[30px] rounded-lg border bg-card px-2.5 hover:bg-muted disabled:opacity-50"
                >
                  ›
                </button>
              </nav>
            )}
            <Link to={`${PATHS.CLERK_VOUCHERS}?view=draft`} className="text-auth-link text-primary hover:underline">
              View in My vouchers →
            </Link>
          </div>
        </div>
      )}

      <AnimatePresence>
        {confirm && (
          <ConfirmDialog
            width={420}
            tone="danger"
            icon={{ icon: Trash2, tone: 'danger' }}
            title={confirm.length === 1 ? 'Delete this draft?' : `Delete ${confirm.length} drafts?`}
            confirmLabel={confirm.length === 1 ? 'Delete draft' : `Delete ${confirm.length} drafts`}
            cancelLabel={confirm.length === 1 ? 'Keep draft' : 'Keep them'}
            busy={busy}
            error={error}
            onConfirm={doDelete}
            onCancel={() => !busy && setConfirm(null)}
          >
            <DeleteText drafts={confirm} />
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  )
}

function DeleteText({ drafts }) {
  const lines = drafts.reduce((n, d) => n + (d.line_count ?? 0), 0)
  const withLines = lines ? ` and ${lines === 1 ? 'its' : 'their'} ${plural(lines, 'line item', 'line items')}` : ''

  if (drafts.length === 1) {
    const d = drafts[0]
    return (
      <p>
        <span className="font-medium text-foreground">
          “{d.payee_name ?? 'Draft'} · {formatMoney(d.amount)}”
        </span>
        {lines ? ` and its ${plural(lines, 'line item', 'line items')}` : ''} will be permanently removed. This can’t be undone.
      </p>
    )
  }
  const total = drafts.reduce((cents, d) => cents + Math.round(Number(d.amount) * 100), 0)
  return (
    <>
      <p>
        These {drafts.length} drafts ({formatMoney((total / 100).toFixed(2))} in all){withLines} will be permanently removed. This can’t be
        undone.
      </p>
      <ul className={cn('flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted px-3 py-2')}>
        {drafts.map((d) => (
          <li key={d.id} className="text-caption flex justify-between gap-3">
            <span className="truncate">{d.payee_name ?? 'Payee not set'}</span>
            <span className="tabular-nums">{formatMoney(d.amount)}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
