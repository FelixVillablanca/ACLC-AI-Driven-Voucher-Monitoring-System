import { cn } from '@/lib/utils'

const TONES = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  primary: 'bg-primary-soft text-primary',
  neutral: 'border bg-muted text-muted-foreground', // "Inactive" / "Not set up" (grey, with a border)
}

/**
 * Small rounded badge (Framer: App/Badge Success / Warning / Danger / Primary, 999px radius).
 *   <Pill tone="success">Active</Pill>
 * Shared by the admin and Super Admin dashboards (moved here from features/admin once a 2nd feature needed it).
 */
export default function Pill({ tone = 'primary', className, children }) {
  return (
    <span className={cn('text-badge inline-flex shrink-0 items-center rounded-full px-2 py-0.5 whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  )
}
