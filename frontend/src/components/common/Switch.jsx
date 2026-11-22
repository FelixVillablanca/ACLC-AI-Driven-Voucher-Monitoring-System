import { cn } from '@/lib/utils'

const SIZES = {
  sm: { track: 'h-[18px] w-8', thumb: 'size-3.5' }, // menus (Companies sort menu)
  md: { track: 'h-[22px] w-10', thumb: 'size-4' }, // settings rows (Framer 40×22)
}

/**
 * On/off switch: a real checkbox (keyboard + screen readers hear "switch, on"), drawn as a pill.
 * Put it inside a <label> together with its text, or pass `label` for an invisible one.
 *
 *   <label className="flex items-center justify-between">Suspended first <Switch checked={on} onChange={setOn} size="sm" /></label>
 */
export default function Switch({ checked, onChange, size = 'md', label, disabled = false, id }) {
  const s = SIZES[size]
  return (
    <span className="relative inline-flex shrink-0">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        // invisible but ON TOP of the pill, so a click on the pill is a click on the checkbox
        // (sr-only alone made it unclickable unless the whole row was a <label>)
        className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex cursor-pointer items-center rounded-full p-0.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
          s.track,
          checked ? 'justify-end bg-primary' : 'justify-start bg-border',
        )}
      >
        <span className={cn('rounded-full bg-card shadow-sm', s.thumb)} />
      </span>
    </span>
  )
}
