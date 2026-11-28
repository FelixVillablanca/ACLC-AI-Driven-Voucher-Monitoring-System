import { Info } from 'lucide-react'
import ModalShell from '@/components/common/ModalShell'

const SENSITIVITY = { relaxed: 'Relaxed', balanced: 'Balanced', strict: 'Strict' }

/**
 * "ⓘ How flags work" on the Flagged page: the automatic check's rules in plain words (they match
 * RuleBasedAnomalyCheck on the server) and the current threshold from the Super Admin's sensitivity.
 */
export default function HowFlagsWorkDialog({ stats, onClose }) {
  return (
    <ModalShell
      title="How flags work"
      subtitle="What the automatic check looks at, and when it flags a voucher."
      width={560}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-5">
        <p className="text-body">
          Right after a clerk submits a voucher, ADVMS runs an automatic check. It is a set of plain rules for now; the AI model replaces
          the score in a later update. Each signal adds to a score from 0 to 1:
        </p>
        <ul className="text-body flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <b>Unusual amount</b>: the total is 1.5× (medium) or 2× (high) the department’s average month for that category, over the last 6
            months.
          </li>
          <li>
            <b>Possible duplicate</b>: the same payee with a total within 10%, submitted in the last 45 days (high).
          </li>
          <li>
            <b>Category mismatch</b>: the payee has 3+ vouchers and this category is rare for them (medium).
          </li>
          <li>
            <b>Budget</b>: approving would pass the department’s alert level (medium) or its whole budget (high) this month.
          </li>
          <li>
            <b>New payee</b>: a first payment of ₱20,000 or more to someone never paid before (medium).
          </li>
        </ul>
        <div className="flex gap-2.5 rounded-[10px] border border-primary-soft bg-primary-faint px-3.5 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-body">
            A voucher is flagged at a score of <b>{stats ? Number(stats.threshold).toFixed(2) : '0.60'}</b> or more (sensitivity:{' '}
            {SENSITIVITY[stats?.sensitivity] ?? 'Balanced'}, set by the platform owner). A flag is not a rejection: you decide. Flagged
            vouchers get the Supervisor’s final approval like every voucher, marked “Flagged” for them.
          </p>
        </div>
        <p className="text-caption">
          Your finding (valid but high, needs changes, false alarm) is saved with the voucher and in the audit log, so the future AI model
          can learn from it.
        </p>
      </div>
      <div className="flex justify-end border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  )
}
