import { useSearchParams, useNavigate } from 'react-router-dom'
import { BellOff, Loader2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/utils'
import NotificationItem from '../components/NotificationItem'
import NotificationSkeleton from '../components/NotificationSkeleton'
import { useNotificationsPage } from '../hooks/useNotificationsPage'
import { groupByDay } from '../utils'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'security', label: 'Security' },
]

const EMPTY = {
  all: { title: 'No notifications yet', description: 'Important changes and alerts will show up here.' },
  unread: { title: "You're all caught up", description: 'There are no unread notifications.' },
  security: { title: 'No security notifications', description: 'Failed sign-ins and other security events will show up here.' },
}

/**
 * "All notifications" (the bell panel's "View all"; code-first 2026-11-22, replaces a coming-soon page).
 * Same list as the bell, full width, 20 at a time with "Load more". `links.categories` says where a
 * click goes (passed in by the router, different for Admin and Super Admin). ?tab=unread|security.
 */
export default function NotificationsPage({ links }) {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'all'
  const navigate = useNavigate()
  const list = useNotificationsPage(tab)

  const setTab = (id) =>
    setParams(
      (p) => {
        if (id === 'all') p.delete('tab')
        else p.set('tab', id)
        return p
      },
      { replace: true },
    )

  const open = (item) => {
    list.markRead(item)
    const to = links?.categories?.[item.category]
    if (to) navigate(to)
  }

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Notifications</h1>
          <p className="text-body text-muted-foreground">
            {list.status === 'success' && list.unread > 0 ? `${list.unread} unread` : 'Changes and alerts that concern you.'}
          </p>
        </div>
        <button
          type="button"
          onClick={list.markAllRead}
          disabled={list.unread === 0 || list.markingAll}
          className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {list.markingAll && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Mark all as read
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div role="tablist" aria-label="Filter notifications" className="flex gap-[18px] border-b px-4 pt-3">
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
                  '-mb-px border-b-2 pb-2.5 outline-none focus-visible:text-primary',
                  active ? 'text-body-strong border-primary' : 'text-body border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        {list.status === 'loading' && <NotificationSkeleton />}

        {list.status === 'error' && (
          <ErrorState
            className="p-8"
            title="Couldn't load notifications"
            message={list.error.message}
            requestId={list.error.requestId}
            onRetry={list.retry}
          />
        )}

        {list.status === 'success' && list.items.length === 0 && (
          <EmptyState className="p-10" icon={BellOff} title={EMPTY[tab].title} description={EMPTY[tab].description} />
        )}

        {list.status === 'success' &&
          groupByDay(list.items).map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="text-table-head px-4 pt-3 pb-1.5 text-muted-foreground">{group.label}</h2>
              <ul>
                {group.items.map((item) => (
                  <NotificationItem key={item.id} item={item} onOpen={open} />
                ))}
              </ul>
            </section>
          ))}

        {list.hasMore && (
          <div className="border-t px-4 py-3">
            <button
              type="button"
              onClick={list.loadMore}
              disabled={list.loadingMore}
              className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {list.loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
