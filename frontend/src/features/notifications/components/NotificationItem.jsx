import { PaymentActions } from '@/features/vouchers'
import { cn } from '@/lib/utils'
import { CATEGORIES, TONE_CLASSES, notificationLook, notificationTime } from '../utils'

/**
 * One notification row (Framer D7aTKQEDz).
 * Unread: light indigo background, coloured icon, bold title, blue dot.
 * Read:   white background, grey icon, normal title.
 * Clicking marks it as read and opens the related page.
 * `item.actions` (2026-11-28): the clerk's final-approval notice gets "Payment PDF" / "Email the payee" buttons on a
 * row under it (buttons can't sit inside the row's own button).
 */
export default function NotificationItem({ item, onOpen }) {
  const { tone, icon: Icon } = notificationLook(item)
  const category = CATEGORIES[item.category]?.label

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors focus-visible:bg-primary-soft',
          item.is_read ? 'bg-card hover:bg-muted' : 'bg-primary-faint hover:bg-primary-soft',
        )}
      >
        <span className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-full', TONE_CLASSES[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={item.is_read ? 'text-body' : 'text-body-strong'}>{item.title}</span>
          <span className="text-caption">{item.message}</span>
          <span className="text-caption">
            {notificationTime(item.created_at)}
            {category && ` · ${category}`}
          </span>
        </span>
        {!item.is_read && (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </button>
      {item.actions?.includes('payment_pdf') && item.voucher_id && (
        <div className={cn('flex px-4 pb-3 pl-[62px]', item.is_read ? 'bg-card' : 'bg-primary-faint')}>
          <PaymentActions voucherId={item.voucher_id} canEmail={item.actions.includes('email_payee')} size="sm" />
        </div>
      )}
    </li>
  )
}
