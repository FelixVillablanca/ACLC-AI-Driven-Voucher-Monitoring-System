import { ArrowRight, RotateCcw } from 'lucide-react'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { plural } from '@/lib/formatters'
import { settingLabel, showValue } from '../utils'

/**
 * "Discard N unsaved changes?" (G2, frame dLJvMyCj2, 460px): each edited setting with
 * what you typed → the last saved value it goes back to. Nothing reaches the server: the edits
 * were never saved, so this only resets the form.
 *   changes: [{ key, from (saved), to (edited) }]
 */
export default function DiscardChangesDialog({ changes, onCancel, onConfirm }) {
  const n = changes.length
  return (
    <ConfirmDialog
      title={`Discard ${plural(n, 'unsaved change', 'unsaved changes')}?`}
      description="These settings go back to their last saved values. Nothing has been applied to any company yet."
      icon={{ icon: RotateCcw, tone: 'danger' }}
      tone="danger"
      confirmLabel="Discard changes"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <ul className="flex flex-col rounded-[10px] border bg-muted">
        {changes.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2.5 last:border-b-0">
            <span className="text-body-strong text-foreground">{settingLabel(c.key)}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-caption line-through decoration-muted-foreground/60">{showValue(c.key, c.to)}</span>
              <ArrowRight className="size-3.5" aria-label="goes back to" />
              <span className="text-body-strong rounded-md border bg-card px-2 py-0.5 text-foreground">{showValue(c.key, c.from)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption">Your edits can’t be brought back after you discard them.</p>
    </ConfirmDialog>
  )
}
