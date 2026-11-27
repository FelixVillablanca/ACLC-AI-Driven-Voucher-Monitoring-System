import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { inputClass } from '@/components/common/FieldShell'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { markNormal } from '../api'

/**
 * "Mark as normal" / "False alarm": the flag is cleared and the voucher stays in the review queue as a normal
 * one (no Supervisor step because of the flag). Optional note, saved in the audit log.
 * 409 FLAG_ALREADY_REVIEWED (someone cleared it first) → onConflict.
 */
export default function MarkNormalDialog({ voucher, onDone, onCancel, onConflict }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      onDone(await markNormal(voucher.id, note.trim()))
    } catch (e) {
      if (e.code === 'FLAG_ALREADY_REVIEWED' || e.code === 'VOUCHER_ALREADY_REVIEWED') return onConflict(e)
      setError(e)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      width={460}
      icon={{ icon: ShieldCheck, tone: 'primary' }}
      title={`Mark ${voucher.voucher_number} as normal?`}
      description={`${voucher.payee_name ?? ''} · ${formatMoney(voucher.amount)}`}
      confirmLabel="Mark as normal"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => !busy && onCancel()}
    >
      <p className="text-body text-foreground">
        The flag is cleared as a false alarm. The voucher stays in the review queue and is reviewed like any other: it no longer needs the
        Supervisor because of the flag.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mn-note" className="text-label text-foreground">
          Why is it normal? (optional)
        </label>
        <textarea
          id="mn-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          disabled={busy}
          placeholder="e.g. Different billing period and SOA number."
          className={cn(inputClass, 'h-auto resize-y py-2')}
        />
      </div>
    </ConfirmDialog>
  )
}
