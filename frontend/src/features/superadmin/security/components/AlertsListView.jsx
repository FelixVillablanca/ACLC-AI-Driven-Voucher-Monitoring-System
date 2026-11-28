import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { PATHS } from '@/lib/constants'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { dismissSecurityAlert, reviewAllSecurityAlerts } from '../api'
import { useSecurityAlerts } from '../hooks/useSecurityAlerts'
import { announceAlertsChanged, TABS } from '../utils'
import AlertCard from './AlertCard'
import AlertCardSkeleton from './AlertCardSkeleton'
import PanelCloseButton from './PanelCloseButton'

const EMPTY = {
  all: { title: 'No security alerts', description: 'When something looks suspicious, like many failed sign-ins, it shows up here.' },
  open: { title: 'You’re all caught up', description: 'Every alert has been reviewed.' },
  closed: { title: 'Nothing reviewed yet', description: 'Alerts you or another Super Admin review or dismiss show up here.' },
}

/** The list (Framer mQcXDCyDZ): header + tabs, alert cards on a Muted background, footer. */
export default function AlertsListView({ onOpenAlert, onClose }) {
  const [tab, setTab] = useState('all')
  const list = useSecurityAlerts(TABS.find((t) => t.key === tab).status)
  const [busyId, setBusyId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)
  const counts = list.counts

  const afterChange = () => {
    announceAlertsChanged()
    return list.reload({ quiet: true })
  }

  const dismiss = async (alert) => {
    setBusyId(alert.id)
    try {
      await dismissSecurityAlert(alert.id)
      toast.success('Alert dismissed')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusyId(null)
      afterChange() // also after a 409: someone else closed it, so show the new state
    }
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      const count = await reviewAllSecurityAlerts()
      toast.success(count ? `${plural(count, 'alert', 'alerts')} marked as reviewed` : 'Nothing left to review')
      await afterChange()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setMarkingAll(false)
    }
  }

  const loadMore = () => list.loadMore().catch((error) => toast.error(`Couldn't load more alerts. ${error.message}`))

  return (
    <>
      <header className="flex flex-col gap-3 border-b px-5 pt-5 pb-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-page-title">Security alerts</h2>
            <p className="text-caption">
              {counts ? `${plural(counts.last_24h, 'alert', 'alerts')} in the last 24 hours · ${counts.open} not reviewed` : 'Loading…'}
            </p>
          </div>
          <PanelCloseButton onClick={onClose} />
        </div>

        <div role="tablist" aria-label="Filter alerts" className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = t.key === tab
            const count = counts?.[t.key]
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex h-[30px] items-center rounded-full border px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active ? 'text-badge border-primary bg-primary-soft text-primary' : 'text-caption bg-card hover:bg-muted',
                )}
              >
                {t.label}
                {count !== undefined && ` (${count})`}
              </button>
            )
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted px-5 py-4">
        {list.status === 'loading' && (
          <div role="status" aria-label="Loading alerts" className="flex flex-col gap-3">
            <AlertCardSkeleton />
            <AlertCardSkeleton />
            <AlertCardSkeleton />
          </div>
        )}

        {list.status === 'error' && (
          <ErrorState
            title="Couldn't load the alerts"
            message={list.error.message}
            requestId={list.error.requestId}
            onRetry={() => list.reload()}
          />
        )}

        {list.status === 'success' && list.alerts.length === 0 && (
          <EmptyState icon={ShieldCheck} title={EMPTY[tab].title} description={EMPTY[tab].description} />
        )}

        {list.status === 'success' &&
          list.alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              busy={busyId === alert.id}
              onReview={() => onOpenAlert(alert.id)}
              onDismiss={() => dismiss(alert)}
            />
          ))}

        {list.status === 'success' && list.hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={list.loadingMore}
            className="text-auth-link flex h-9 items-center justify-center gap-1.5 self-center rounded-lg px-3 text-primary outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {list.loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Load more
          </button>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t px-5 py-3.5">
        <Link
          to={PATHS.SUPERADMIN_AUDIT_LOGS}
          onClick={onClose}
          className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Open audit log →
        </Link>
        <button
          type="button"
          onClick={markAll}
          disabled={markingAll || !counts?.open}
          className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {markingAll && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Mark all as reviewed
        </button>
      </footer>
    </>
  )
}
