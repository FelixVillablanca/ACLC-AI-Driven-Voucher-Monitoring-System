import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Info, Loader2, Pencil, Plus, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import SidePanel, { PanelClose } from '@/components/common/SidePanel'
import { statusPill } from '@/features/vouchers'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getPayee, setPayeeActive } from '../api'
import { announcePayeesChanged, PAY_VIA, PAYEES_CHANGED_EVENT, payeeInitials, typeTone } from '../utils'

/**
 * Payee side panel (Framer GZb92vr4M, 440px): name + type, 3 number tiles, details, recent vouchers,
 * then Edit / Deactivate / New voucher for this payee. The numbers and vouchers are the clerk's OWN.
 * Code differs from the frame: "Edit" instead of "Request edit" (clerks edit directly, user decision
 * 2026-11-26), Deactivate / Reactivate added, no AI "usual range" box (no AI yet), "Approved this year"
 * instead of "Paid YTD" (approved isn't paid out).
 */
export default function PayeePanel({ id, onClose, onEdit }) {
  const [state, setState] = useState({ id: null, status: 'loading', payee: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = (quiet) =>
      getPayee(id)
        .then((payee) => alive && setState({ id, status: 'success', payee, error: null }))
        .catch((error) => alive && !quiet && setState({ id, status: 'error', payee: null, error }))
    load(false)
    const onChanged = () => load(true)
    window.addEventListener(PAYEES_CHANGED_EVENT, onChanged)
    return () => {
      alive = false
      window.removeEventListener(PAYEES_CHANGED_EVENT, onChanged)
    }
  }, [id, attempt])

  const status = state.id === id ? state.status : 'loading'
  const p = state.payee

  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await setPayeeActive(p.id, !p.is_active)
      toast.success(
        saved.is_active ? `${saved.name} is active again.` : `${saved.name} was deactivated. It won’t be offered on new vouchers.`,
      )
      setConfirm(false)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
      announcePayeesChanged()
    }
  }

  const footer = status === 'success' && (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setConfirm(true)
        }}
        className={cn(
          'text-body-strong mr-auto flex h-[38px] items-center gap-1.5 rounded-lg px-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50',
          p.is_active ? 'text-danger' : 'text-primary',
        )}
      >
        <Power className="size-4" aria-hidden="true" /> {p.is_active ? 'Deactivate' : 'Reactivate'}
      </button>
      <button
        type="button"
        onClick={() => onEdit(p)}
        className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Pencil className="size-4" aria-hidden="true" /> Edit
      </button>
      {p.is_active && (
        <Link
          to={`${PATHS.CLERK_VOUCHER_NEW}?payee=${p.id}`}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden="true" /> New voucher for {p.name.length > 18 ? 'this payee' : p.name}
        </Link>
      )}
    </>
  )

  return (
    <SidePanel label={p ? `Payee ${p.name}` : 'Payee'} width={440} onClose={onClose} footer={footer}>
      {status === 'loading' && (
        <div role="status" className="flex flex-1 items-center justify-center gap-2 p-16">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the payee…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col">
          <div className="flex justify-end px-5 pt-4">
            <PanelClose onClick={onClose} />
          </div>
          <ErrorState
            title={state.error.status === 404 ? 'Payee not found' : "Couldn't load this payee"}
            message={state.error.status === 404 ? 'It isn’t a payee of the company you’re working in.' : state.error.message}
            requestId={state.error.requestId}
            onRetry={state.error.status === 404 ? undefined : () => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {status === 'success' && (
        <>
          <header className="flex items-start gap-3 border-b px-5 py-4">
            <Avatar name={p.name} tone={typeTone(p.type?.name)} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h2 className="text-card-title break-words">{p.name}</h2>
              <p className="text-caption">
                {[p.type?.name ?? 'No type', `Added ${formatDate(p.created_at, 'MMM yyyy')}${p.added_by ? ` by ${p.added_by}` : ''}`].join(
                  ' · ',
                )}
              </p>
              {!p.is_active && (
                <div className="pt-1">
                  <Pill tone="neutral">Deactivated</Pill>
                </div>
              )}
            </div>
            <PanelClose onClick={onClose} />
          </header>

          <div className="flex flex-col gap-4 px-5 py-[18px]">
            <div className="grid grid-cols-3 gap-2.5">
              <Tile label="Approved this year" value={formatMoney(p.stats.approved_ytd)} />
              <Tile label="Vouchers" value={p.stats.vouchers_count} />
              <Tile label="Avg / month" value={formatMoney(p.avg_per_month)} />
            </div>
            <p className="text-caption -mt-2 flex items-center gap-1.5">
              <Info className="size-3.5 shrink-0" aria-hidden="true" /> Numbers count your own vouchers only.
            </p>

            <section className="flex flex-col gap-2.5" aria-labelledby="payee-details">
              <h3 id="payee-details" className="text-table-head text-muted-foreground">
                Payee details
              </h3>
              <dl className="flex flex-col gap-2">
                <Row label="TIN" value={p.tin} />
                <Row label="Default payment" value={[PAY_VIA[p.default_payment_method], p.bank_name].filter(Boolean).join(' · ') || null} />
                {p.default_payment_method === 'bank' && <Row label="Account no." value={p.bank_account_number} />}
                {p.default_payment_method === 'bank' && <Row label="Account name" value={p.bank_account_name} />}
                <Row label="Address" value={p.address} />
                <Row label="Email" value={p.email} />
                <Row label="Usual category" value={p.usual_category} empty="No vouchers yet" />
              </dl>
            </section>

            <section className="flex flex-col" aria-labelledby="payee-recent">
              <h3 id="payee-recent" className="text-table-head pb-1.5 text-muted-foreground">
                Your recent vouchers
              </h3>
              {p.recent_vouchers.length === 0 ? (
                <p className="text-caption rounded-lg border border-dashed px-3 py-4 text-center">
                  You haven’t made a voucher for this payee yet.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {p.recent_vouchers.map((v) => {
                    const pill = statusPill(v.status)
                    return (
                      <li key={v.id}>
                        <Link
                          to={`${PATHS.CLERK_VOUCHERS}/${v.id}`}
                          className="flex items-center gap-3 border-b py-2.5 outline-none last:border-b-0 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-px">
                            <span className="text-body-strong">{v.voucher_number ?? 'Draft'}</span>
                            <span className="text-caption truncate">
                              {[formatDate(v.at, 'MMM d'), v.summary].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-body-strong tabular-nums">{formatMoney(v.amount)}</span>
                            <Pill tone={pill.tone}>{pill.text}</Pill>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <AnimatePresence>
        {confirm && p && (
          <ConfirmDialog
            width={420}
            tone={p.is_active ? 'danger' : undefined}
            icon={{ icon: Power, tone: p.is_active ? 'danger' : 'primary' }}
            title={p.is_active ? `Deactivate ${p.name}?` : `Reactivate ${p.name}?`}
            confirmLabel={p.is_active ? 'Deactivate' : 'Reactivate'}
            cancelLabel="Cancel"
            busy={busy}
            error={error}
            onConfirm={toggle}
            onCancel={() => !busy && setConfirm(false)}
          >
            <p>
              {p.is_active
                ? 'It won’t be offered on new vouchers for anyone in this company. Vouchers that already use it keep it, and you can reactivate it any time.'
                : 'It will be offered on new vouchers again.'}
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </SidePanel>
  )
}

export function Avatar({ name, tone, size = 'size-11' }) {
  const tones = {
    warning: 'bg-warning-soft text-warning',
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    neutral: 'bg-muted text-muted-foreground border',
  }
  return (
    <span
      aria-hidden="true"
      className={cn('text-badge flex shrink-0 items-center justify-center rounded-full', size, tones[tone] ?? tones.primary)}
    >
      {payeeInitials(name)}
    </span>
  )
}

function Tile({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted p-3">
      <span className="text-caption">{label}</span>
      <span className="text-card-title truncate tabular-nums" title={String(value)}>
        {value}
      </span>
    </div>
  )
}

function Row({ label, value, empty = 'Not set' }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-caption shrink-0">{label}</dt>
      <dd className={cn('text-body-strong text-right break-words', !value && 'font-normal text-muted-foreground')}>{value ?? empty}</dd>
    </div>
  )
}
