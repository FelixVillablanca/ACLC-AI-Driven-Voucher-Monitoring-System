import { CalendarClock } from 'lucide-react'
import ModalShell from '@/components/common/ModalShell'
import { formatDate } from '@/lib/formatters'

/**
 * "⟳ Schedules" (Framer ARxG8Aa6F header): what runs by itself (user decision 2026-11-27). Read-only: one automatic
 * report a month; quarterly and department reports are made with "Generate report".
 */
export default function SchedulesDialog({ next, ai, onClose }) {
  return (
    <ModalShell title="Report schedules" subtitle="What the system makes by itself" width={500} onClose={onClose}>
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex gap-3 rounded-xl border p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CalendarClock className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-body-strong">Monthly expense report · all departments</p>
            <p className="text-caption">
              On the 1st of every month at 3:00 AM, for the month before. Includes the breakdowns, the flagged list, the forecast
              {ai?.configured ? ' and an AI summary.' : '. The AI summary is added once OpenAI is set up.'}
            </p>
            <p className="text-badge mt-1 text-primary">
              Next: {formatDate(next.date, 'EEEE, MMM d')} · {next.label}
            </p>
          </div>
        </div>
        <p className="text-caption">
          Every Accounting Officer of this company gets a bell notice when it’s ready. Quarterly and department reports are made with
          “Generate report”.
        </p>
      </div>
      <div className="flex justify-end border-t bg-muted px-6 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Close
        </button>
      </div>
    </ModalShell>
  )
}
