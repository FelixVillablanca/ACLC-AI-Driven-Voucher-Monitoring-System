import { cn } from '@/lib/utils'

const TILE_TONES = {
  primary: 'bg-primary-soft text-primary',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
}

/**
 * One section card on the Global settings page (Framer tsrXCiWWw): 36px icon tile, title,
 * caption, an optional pill on the right ("● ML service online"), then its setting rows.
 * `id` is the anchor the left-hand section list scrolls to.
 */
export default function SettingsCard({ id, icon: Icon, tone = 'primary', title, caption, aside, children, className }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('flex scroll-mt-24 flex-col overflow-hidden rounded-xl border bg-card', className)}
    >
      <header className="flex items-start gap-3 px-5 pt-[18px] pb-3.5">
        <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-[10px]', TILE_TONES[tone])}>
          <Icon className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`${id}-title`} className="text-card-title">
            {title}
          </h2>
          <p className="text-caption">{caption}</p>
        </div>
        {aside}
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}
