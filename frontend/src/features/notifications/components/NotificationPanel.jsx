import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BellOff, Loader2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/utils'
import { useNotificationList } from '../hooks/useNotificationList'
import { groupByDay, notificationTarget } from '../utils'
import NotificationItem from './NotificationItem'
import NotificationSkeleton from './NotificationSkeleton'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'security', label: 'Security' },
]

const EMPTY = {
  all: { title: 'No notifications yet', description: 'Important changes and alerts will show up here.' },
  unread: { title: "You're all caught up", description: 'There are no unread notifications.' },
  security: { title: 'No security alerts', description: 'Failed sign-ins and other security events will show up here.' },
}

/**
 * The 392px notifications dropdown (Framer D7aTKQEDz): header, tabs,
 * "Today" / "Earlier" groups, footer links. Has Loading / Error / Empty states.
 */
export default function NotificationPanel({ unreadCount, onCountChange, links, onClose, className }) {
  const [tab, setTab] = useState('all')
  const navigate = useNavigate()
  const { status, items, error, retry, markRead, markAllRead, markingAll } = useNotificationList(tab, onCountChange)

  const openItem = (item) => {
    markRead(item)
    const to = notificationTarget(links, item)
    if (to) {
      onClose()
      navigate(to)
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-label="Notifications"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className={cn(
        'z-50 flex flex-col overflow-hidden rounded-xl border bg-card text-foreground shadow-xl shadow-foreground/10',
        className,
      )}
    >
      {/* Header + tabs */}
      <div className="flex flex-col gap-3 border-b px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-card-title">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-badge rounded-full bg-primary px-2 py-0.5 text-primary-foreground">{unreadCount} new</span>
            )}
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0 || markingAll}
            className="text-auth-link flex items-center gap-1.5 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            {markingAll && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            Mark all as read
          </button>
        </div>

        <div role="tablist" aria-label="Filter notifications" className="flex gap-[18px]">
          {TABS.map(({ id, label }) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 outline-none focus-visible:text-primary',
                  active ? 'text-body-strong border-primary' : 'text-body border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {id === 'unread' && unreadCount > 0 && (
                  <span className="text-badge rounded-full bg-primary-soft px-1.5 text-primary">{unreadCount}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      <div role="tabpanel" className="max-h-[min(460px,calc(100dvh-220px))] overflow-y-auto">
        {status === 'loading' && <NotificationSkeleton />}

        {status === 'error' && (
          <ErrorState
            className="p-6"
            title="Couldn't load notifications"
            message={error.message}
            requestId={error.requestId}
            onRetry={retry}
          />
        )}

        {status === 'success' && items.length === 0 && (
          <EmptyState className="p-8" icon={BellOff} title={EMPTY[tab].title} description={EMPTY[tab].description} />
        )}

        {status === 'success' &&
          groupByDay(items).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="text-table-head px-4 pt-2.5 pb-1.5 text-muted-foreground">{group.label}</h3>
              <ul className="border-t">
                {group.items.map((item) => (
                  <NotificationItem key={item.id} item={item} onOpen={openItem} />
                ))}
              </ul>
            </section>
          ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t bg-muted px-4 py-3">
        <Link to={links.viewAll} onClick={onClose} className="text-auth-link text-primary hover:underline">
          View all notifications
        </Link>
      </div>
    </motion.div>
  )
}
