import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Loader2, NotebookPen, RotateCw } from 'lucide-react'
import { normalizeApiError } from '@/lib/apiError'
import { formatDate, formatSignInTime } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getVoucherCheques } from '../api'
import { LIVE_STATUSES, staleHint } from '../utils'
import ChequeDialog from './ChequeDialog'
import ChequeStatusPill from './ChequeStatusPill'

const btn =
  'text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50'

/**
 * The cheque of an APPROVED cheque voucher, on the clerk's voucher page (cheque register, 2026-11-29):
 * record it (number, date, bank), then Release → Mark cleared, or Cancel; cancelled / stale ones stay listed below
 * and a replacement can be recorded. voucher = the VoucherResource ({ id, voucher_number, amount, payee_name }).
 */
export default function VoucherChequeCard({ voucher }) {
  const [attempt, setAttempt] = useState(0)
  const reqKey = `${voucher.id}:${attempt}`
  const [state, setState] = useState({ key: null, voucherId: null, status: 'loading', error: null, cheques: [] })
  const [dialog, setDialog] = useState(null) // { mode, cheque? }
  const load = () => setAttempt((n) => n + 1)

  useEffect(() => {
    const controller = new AbortController()
    getVoucherCheques(voucher.id, { signal: controller.signal })
      .then((cheques) => setState({ key: reqKey, voucherId: voucher.id, status: 'success', error: null, cheques }))
      .catch(
        (err) =>
          !controller.signal.aborted &&
          setState({ key: reqKey, voucherId: voucher.id, status: 'error', error: normalizeApiError(err), cheques: [] }),
      )
    return () => controller.abort()
  }, [reqKey, voucher.id])

  // after an action the old cheque stays on screen until the new answer arrives (no flash of "Loading")
  const current = state.key === reqKey || (state.voucherId === voucher.id && state.status === 'success')
  const status = current ? state.status : 'loading'
  const live = state.cheques.find((c) => LIVE_STATUSES.includes(c.status))
  const earlier = state.cheques.filter((c) => c !== live)

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-card-title">Cheque</h2>
        {live && <ChequeStatusPill cheque={live} />}
      </div>

      {status === 'loading' ? (
        <p className="text-caption flex items-center gap-2 px-4 py-6">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading the cheque…
        </p>
      ) : status === 'error' ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-body text-danger">{state.error.message}</p>
          <button type="button" onClick={() => load()} className={btn}>
            <RotateCw className="size-4" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          {live ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Fact label="Cheque no." value={live.cheque_number} strong />
                <Fact label="Cheque date" value={formatDate(live.cheque_date, 'MMM d, yyyy')} />
                <Fact label="Bank" value={live.bank_name} />
                <Fact
                  label={live.status === 'cleared' ? 'Cleared on' : live.status === 'released' ? 'Received by' : 'Goes stale'}
                  value={
                    live.status === 'cleared'
                      ? formatDate(live.cleared_on, 'MMM d, yyyy')
                      : live.status === 'released'
                        ? live.received_by
                        : formatDate(live.stale_on, 'MMM d, yyyy')
                  }
                />
              </dl>
              {live.status !== 'cleared' && (
                <p className={cn('text-caption', live.days_left != null && live.days_left <= 30 && 'font-medium text-warning')}>
                  {live.status === 'issued' ? 'Written, not handed over yet. ' : `Released ${formatSignInTime(live.released_at)}. `}
                  {staleHint(live)}.
                </p>
              )}
              {(live.can.release || live.can.clear || live.can.cancel) && (
                <div className="flex flex-wrap gap-2">
                  {live.can.release && (
                    <button type="button" onClick={() => setDialog({ mode: 'release', cheque: live })} className={btn}>
                      Mark released
                    </button>
                  )}
                  {live.can.clear && (
                    <button type="button" onClick={() => setDialog({ mode: 'clear', cheque: live })} className={btn}>
                      Mark cleared
                    </button>
                  )}
                  {live.can.cancel && (
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: 'cancel', cheque: live })}
                      className={cn(btn, 'border-transparent text-danger hover:bg-danger-soft')}
                    >
                      Cancel cheque
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-muted-foreground">
                {earlier.length ? 'The last cheque can’t be used any more. Record the replacement cheque.' : 'No cheque recorded yet.'}{' '}
                Record it once it’s written, so the payment PDF and the cheque register show it.
              </p>
              <button
                type="button"
                onClick={() => setDialog({ mode: 'record' })}
                className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <NotebookPen className="size-4" aria-hidden="true" /> Record cheque
              </button>
            </div>
          )}

          {earlier.length > 0 && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <p className="text-table-head text-muted-foreground">Earlier cheques</p>
              {earlier.map((c) => (
                <div key={c.id} className="text-body flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{c.cheque_number}</span>
                  <span className="text-muted-foreground">
                    {c.bank_name} · {formatDate(c.cheque_date, 'MMM d, yyyy')}
                  </span>
                  <ChequeStatusPill cheque={c} />
                  {c.cancel_reason && <span className="text-caption">“{c.cancel_reason}”</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {dialog && (
          <ChequeDialog
            mode={dialog.mode}
            cheque={dialog.cheque}
            voucher={{ id: voucher.id, number: voucher.voucher_number, amount: voucher.amount, payee_name: voucher.payee_name }}
            onDone={() => load()}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

function Fact({ label, value, strong }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption">{label}</dt>
      <dd className={cn('text-body truncate', strong && 'font-semibold')}>{value || '—'}</dd>
    </div>
  )
}
