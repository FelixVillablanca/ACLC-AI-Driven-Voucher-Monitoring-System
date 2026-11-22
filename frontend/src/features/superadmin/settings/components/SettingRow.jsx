import Pill from '@/components/common/Pill'
import { cn } from '@/lib/utils'

/**
 * One setting: name (+ amber "Edited · was …" while it has an unsaved edit), a caption, and the
 * control on the right. An edited row is tinted Primary Faint, as in the frame.
 *   wasText: the saved value as text, shown only when `edited`
 *   error:   a problem with what's typed ("Type an amount like 50,000.00")
 */
export default function SettingRow({ id, title, caption, edited = false, wasText, error, stacked = false, children }) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-x-6 gap-y-3 border-t px-5 py-3.5',
        stacked ? 'flex-col' : 'items-center justify-between',
        edited && 'bg-primary-faint',
      )}
    >
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="text-body-strong">
            {title}
          </label>
          {edited && <Pill tone="warning">Edited · was {wasText}</Pill>}
        </div>
        {caption && <p className="text-caption">{caption}</p>}
        {error && (
          <p id={`${id}-error`} role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </div>
      <div className={cn('flex shrink-0 items-center', stacked && 'w-full')}>{children}</div>
    </div>
  )
}
