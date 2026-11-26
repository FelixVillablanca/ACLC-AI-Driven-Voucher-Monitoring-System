import { cn } from '@/lib/utils'

const TONES = {
  primary: 'bg-primary-soft text-primary',
  ai: 'bg-primary text-white',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
}

/** The 34px icon tile on a guide card (Framer V0J_GkScn). */
export function GuideIcon({ guide }) {
  const Icon = guide.icon
  return (
    <span className={cn('flex size-[34px] items-center justify-center rounded-lg', TONES[guide.tone] ?? TONES.primary)} aria-hidden="true">
      <Icon className="size-4" />
    </span>
  )
}
