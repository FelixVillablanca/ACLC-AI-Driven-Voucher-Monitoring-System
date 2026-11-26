import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useCompanyStore } from '@/stores/useCompanyStore'
import { getApprovalRules } from '../api'
import { centsToAmount } from '../utils'

/**
 * Right column of Fix & resubmit (Framer EWrCKOIlI): the live total vs. the total when it came back,
 * voucher number, company, line count, then who looks at it next (Approval route).
 * Code differs from the frame (real data only): no department budget line (budgets are Phase 4), no
 * "AI pre-check" box (Phase 5) and no attachment upload (attachments aren't built yet; a note says so).
 */
export default function ReturnSummary({ voucher, totalCents, lineCount }) {
  const companies = useAuthStore((s) => s.user?.companies ?? [])
  const companyId = useCompanyStore((s) => s.activeCompanyId)
  const company = companies.find((c) => c.id === companyId)?.name

  const wasCents = Math.round(Number(voucher.returned?.amount_at_return ?? voucher.amount) * 100)
  const diff = totalCents - wasCents

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-[18px]" aria-labelledby="return-summary">
        <h2 id="return-summary" className="text-card-title">
          Summary
        </h2>
        <div className="flex flex-col gap-0.5 rounded-lg bg-primary-faint p-3.5">
          <p className="text-caption">Total amount</p>
          <p className="text-stat-value tabular-nums" aria-live="polite">
            {formatMoney(centsToAmount(totalCents))}
          </p>
          <p className="text-caption">
            {diff === 0
              ? 'Same as when it was returned'
              : `Was ${formatMoney(centsToAmount(wasCents))} · ${diff < 0 ? '−' : '+'}${formatMoney(centsToAmount(Math.abs(diff)))} after fixes`}
          </p>
        </div>
        <Row label="Voucher no." value={voucher.voucher_number} />
        {company && <Row label="Company" value={company} />}
        <Row label="Line items" value={lineCount} />
      </section>

      <ApprovalRoute voucher={voucher} totalCents={totalCents} />

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-[18px]" aria-labelledby="return-attachments">
        <h2 id="return-attachments" className="text-card-title">
          Attachments
        </h2>
        <p className="text-caption flex gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Uploading receipts comes in an upcoming update. If the reviewer asked for a document, tell them how you’ll send it in the
          voucher’s notes.
        </p>
      </section>
    </aside>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-caption">{label}</span>
      <span className="text-body-strong truncate">{value}</span>
    </div>
  )
}

/** You → Accounting re-review (always; a resubmitted voucher starts at step 1) → Supervisor, when the rules say so. */
function ApprovalRoute({ voucher, totalCents }) {
  const [rules, setRules] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    getApprovalRules()
      .then((r) => alive && setRules(r))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const r = voucher.returned
  const officer = r?.step === 1 && r.by ? `${r.by} · Level 1` : 'Accounting Officer · Level 1'

  let supervisor = 'Level 2 · when the approval rules require it'
  if (rules) {
    const thresholdCents = Math.round(Number(rules.high_value_threshold) * 100)
    const aiRule = rules.ai_flagged_needs_step2
    if (totalCents >= thresholdCents) supervisor = `Level 2 · needed: total is ${formatMoney(rules.high_value_threshold)} or more`
    else if (aiRule && voucher.ai_flagged) supervisor = 'Level 2 · needed: flagged by the AI check'
    else supervisor = `Level 2 · only if ${formatMoney(rules.high_value_threshold)} or more${aiRule ? ' or AI-flagged' : ''}`
  } else if (!failed) {
    supervisor = 'Level 2 · checking the rules…'
  }

  const steps = [
    { title: 'You · Accounting Clerk', caption: 'Fix and resubmit', current: true },
    { title: 'Accounting re-review', caption: officer },
    { title: 'Supervisor / Manager', caption: supervisor },
  ]

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-[18px]" aria-labelledby="return-route">
      <h2 id="return-route" className="text-card-title">
        Approval route
      </h2>
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-2.5" aria-current={s.current ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={cn(
                'text-badge flex size-[26px] shrink-0 items-center justify-center rounded-full',
                s.current ? 'bg-primary text-white' : 'bg-primary-soft text-primary',
              )}
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-px">
              <span className="text-body-strong">{s.title}</span>
              <span className="text-caption">{s.caption}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
