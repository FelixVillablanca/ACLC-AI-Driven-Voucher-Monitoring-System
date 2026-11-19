import { cn } from '@/lib/utils'

const TONES = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-primary-soft text-primary',
}

/** Small rounded badge (Framer: App/Badge Success / Warning / Primary, 999px radius). */
export default function Pill({ tone = 'primary', className, children }) {
  return (
    <span className={cn('text-badge inline-flex shrink-0 items-center rounded-full px-2 py-0.5', TONES[tone], className)}>
      {children}
    </span>
  )
}
