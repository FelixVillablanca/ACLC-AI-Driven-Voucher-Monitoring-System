import { useEffect, useId } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const CONFIRM_TONES = {
  danger: 'bg-danger text-white hover:bg-danger/90',
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  success: 'bg-success text-white hover:bg-success/90', // Approve (Framer pzSaaMGhY)
  warning: 'bg-warning text-white hover:bg-warning/90', // Return to clerk (Framer XT9f8T3lY)
}

const ICON_TONES = {
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-primary-soft text-primary',
}

/**
 * "Are you sure?" dialog (14px radius, Muted footer, like the other Framer modals).
 * Render it only while it's open, inside <AnimatePresence>.
 *
 *   <ConfirmDialog title="Deactivate John's account?" confirmLabel="Deactivate account" tone="danger"
 *     busy={saving} error={error} onConfirm={…} onCancel={…}>
 *     …what will happen, extra fields…
 *   </ConfirmDialog>
 *
 * `error` (an ApiError) is shown inside the dialog, so the person can fix it and try again.
 * `as="form"` + onConfirm makes Enter in a field press the confirm button.
 */
export default function ConfirmDialog({
  title,
  confirmLabel,
  tone = 'primary',
  busy = false,
  error,
  onConfirm,
  onCancel,
  confirmDisabled = false, // e.g. a checklist isn't complete yet
  extraAction = null, // { label, onClick }: one more button, before the confirm button
  width = 460,
  icon = null, // optional 44px tile above the title, e.g. { icon: Ban, tone: 'danger' } (Companies C6 / C7)
  description = null, // optional muted line under the title
  cancelLabel = 'Cancel', // e.g. "Keep draft"
  children,
}) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation()
        onCancel()
      }
    }
    // capture: the dialog gets Esc before the panel underneath it
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel])

  const submit = (e) => {
    e.preventDefault()
    if (!busy && !confirmDisabled) onConfirm()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/45 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
    >
      <motion.form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={{ width }}
        className="flex max-h-[calc(100dvh-2rem)] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl"
      >
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-6 pt-6 pb-5">
          {icon && (
            <div
              className={cn('mb-0.5 flex size-11 items-center justify-center rounded-xl', ICON_TONES[icon.tone ?? 'primary'])}
              aria-hidden="true"
            >
              <icon.icon className="size-5" />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className={icon ? 'text-page-title' : 'text-card-title text-base'}>
              {title}
            </h2>
            {description && <p className="text-body text-muted-foreground">{description}</p>}
          </div>
          <div className="text-body flex flex-col gap-3 text-muted-foreground">{children}</div>

          {error && (
            <div role="alert" className="flex gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-body-strong text-danger">{error.message}</p>
                {error.requestId && <p className="text-caption">Reference: {error.requestId}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-muted px-6 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          {extraAction && (
            <button
              type="button"
              onClick={extraAction.onClick}
              disabled={busy}
              className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {extraAction.label}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || confirmDisabled}
            className={cn(
              'text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg px-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
              CONFIRM_TONES[tone],
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}
