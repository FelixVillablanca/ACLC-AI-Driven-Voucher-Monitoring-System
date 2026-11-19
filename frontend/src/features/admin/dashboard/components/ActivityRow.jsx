import { cn } from '@/lib/utils'
import { describeActivity } from '../utils'
import Pill from './Pill'

const CIRCLE = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  primary: 'bg-primary-soft text-primary',
}

/** One line of "Recent activity": icon circle, what happened, where/when, badge. */
export default function ActivityRow({ item }) {
  const { title, subtitle, badge, tone, icon: Icon } = describeActivity(item)

  return (
    <li className="flex items-center gap-3 border-b px-[18px] py-3 last:border-b-0">
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', CIRCLE[tone])}>
        <Icon className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body-strong truncate">{title}</p>
        {subtitle && <p className="text-caption truncate">{subtitle}</p>}
      </div>
      <Pill tone={tone}>{badge}</Pill>
    </li>
  )
}
