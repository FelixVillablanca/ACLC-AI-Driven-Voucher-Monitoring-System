import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { HardDriveDownload, Loader2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { BlockIpDialog, announceAuditChanged } from '@/features/superadmin/audit'
import { RUN_BACKUP_SEARCH } from '@/features/superadmin/backups'
import { formatTimeAgo, plural } from '@/lib/formatters'
import { listBlockedIps } from '../api'
import BlockedAddresses from '../components/BlockedAddresses'
import IncidentPanel from '../components/IncidentPanel'
import JobDetailPanel from '../components/JobDetailPanel'
import JobsNeedLook from '../components/JobsNeedLook'
import JobsPanel from '../components/JobsPanel'
import RecentIncidents from '../components/RecentIncidents'
import ServiceGrid from '../components/ServiceGrid'
import UnblockDialog from '../components/UnblockDialog'
import UptimeStrip from '../components/UptimeStrip'
import { useSystemHealth } from '../hooks/useSystemHealth'
import { HEALTH_CHANGED_EVENT, announceHealthChanged, serviceLabel } from '../utils'

/**
 * The Super Admin's System health tab (Framer m80KDanOj) with
 *   SH1 Check now · SH2/SH3 Run backup (the existing ?run=backup window) · SH4 Background jobs panel ·
 *   SH5 Job details · SH6 Retry failed (the existing ?retry=jobs window) · SH7 Uptime day details ·
 *   SH8 Block an address · SH9 Unblock · SH10 Incident details.
 *
 * Side panels live in the address (?panel=jobs · ?job=<uuid> · ?incident=12), so a link opens them.
 * Every number comes from a real check; the scheduler records one every minute.
 */
export default function SystemHealthPage() {
  const health = useSystemHealth()
  const [params, setParams] = useSearchParams()
  const [justChecked, setJustChecked] = useState(null)
  const [dialog, setDialog] = useState(null) // { type: 'block' } | { type: 'unblock', block }
  const [blocks, setBlocks] = useState({ list: null, error: null })

  const loadBlocks = useCallback(
    () =>
      listBlockedIps()
        .then((list) => setBlocks({ list, error: null }))
        .catch((error) => setBlocks((prev) => ({ list: prev.list, error }))),
    [],
  )
  useEffect(() => {
    loadBlocks()
    window.addEventListener(HEALTH_CHANGED_EVENT, loadBlocks)
    return () => window.removeEventListener(HEALTH_CHANGED_EVENT, loadBlocks)
  }, [loadBlocks])

  const setParam = useCallback(
    (name, value) =>
      setParams(
        (p) => {
          if (value) p.set(name, String(value))
          else p.delete(name)
          return p
        },
        { replace: true },
      ),
    [setParams],
  )

  const checkNow = async () => {
    const result = await health.check()
    if (result.ok) {
      // the cards say "· just now" for 10 seconds after a manual check (SH1)
      setJustChecked(new Date().toISOString())
      window.setTimeout(() => setJustChecked(null), 10_000)
      const bad = result.data.attention
      toast.success(
        bad.length ? `Checked. ${plural(bad.length, 'service needs', 'services need')} attention.` : 'Checked. Every service is working.',
      )
    } else {
      toast.error(result.error.status === 429 ? 'Checked many times already. Wait a minute and try again.' : result.error.message)
    }
  }

  const changed = (message) => {
    toast.success(message)
    announceHealthChanged()
    announceAuditChanged()
  }

  if (health.status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-32">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-caption">Checking the services…</span>
      </div>
    )
  }
  if (health.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-7">
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load System health"
            message={health.error.message}
            requestId={health.error.requestId}
            onRetry={health.reload}
          />
        </div>
      </div>
    )
  }

  const d = health.data
  const attention = d.attention

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">System health</h1>
          <p className="text-body text-muted-foreground">
            Live status of the services that keep the platform running. Checked every 60 seconds
            {d.checked_at ? ` · last check ${formatTimeAgo(d.checked_at)}` : ' once the scheduler runs'}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {health.checking ? (
            <Pill tone="primary">◌ Checking 6 services…</Pill>
          ) : attention.length > 0 ? (
            <Pill tone="warning" className="py-1">
              ● {plural(attention.length, 'service needs', 'services need')} attention
            </Pill>
          ) : (
            <Pill tone="success" className="py-1">
              ● Everything is working
            </Pill>
          )}
          <button
            type="button"
            onClick={checkNow}
            disabled={health.checking}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <RefreshCw className={health.checking ? 'size-4 animate-spin' : 'size-4'} aria-hidden="true" />
            {health.checking ? 'Checking…' : 'Check now'}
          </button>
          {d.services.backup.current ? (
            <span className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-muted px-3.5 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Backing up…
            </span>
          ) : (
            <Link
              to={{ search: RUN_BACKUP_SEARCH }}
              className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <HardDriveDownload className="size-4" aria-hidden="true" /> Run backup now
            </Link>
          )}
        </div>
      </div>

      {health.checking && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-primary-soft bg-primary-faint px-4 py-3">
          <RefreshCw className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <div>
            <p className="text-body-strong">Checking all 6 services…</p>
            <p className="text-caption">
              You can keep working. The cards update when the checks come back. The automatic check every 60 seconds still runs.
            </p>
          </div>
        </div>
      )}

      {attention.length > 0 && !health.checking && (
        <p className="text-caption">Needs attention: {attention.map(serviceLabel).join(', ')}.</p>
      )}

      <ServiceGrid services={d.services} checking={health.checking} checkedAt={justChecked} onOpenJobs={() => setParam('panel', 'jobs')} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <JobsNeedLook retrying={d.retrying} failed={d.failed} onOpenJob={(uuid) => setParam('job', uuid)} />
        </div>
        <div className="flex flex-col gap-4 lg:w-[360px] lg:shrink-0">
          <UptimeStrip uptime={d.uptime} onOpenIncident={(id) => setParam('incident', id)} />
          <BlockedAddresses
            blocks={blocks.list}
            error={blocks.error}
            onBlock={() => setDialog({ type: 'block' })}
            onUnblock={(block) => setDialog({ type: 'unblock', block })}
          />
          <RecentIncidents incidents={d.incidents} onOpen={(id) => setParam('incident', id)} />
        </div>
      </div>

      <AnimatePresence>
        {params.get('panel') === 'jobs' && <JobsPanel key="jobs" onClose={() => setParam('panel', null)} />}
        {params.get('job') && (
          <JobDetailPanel
            key={`job-${params.get('job')}`}
            uuid={params.get('job')}
            onClose={() => setParam('job', null)}
            onChanged={(message) => {
              setParam('job', null)
              changed(message)
            }}
          />
        )}
        {Number(params.get('incident')) > 0 && (
          <IncidentPanel
            key={`incident-${params.get('incident')}`}
            id={Number(params.get('incident'))}
            onClose={() => setParam('incident', null)}
            onResolved={changed}
          />
        )}
        {dialog?.type === 'block' && (
          <BlockIpDialog
            key="block"
            onCancel={() => setDialog(null)}
            onDone={(message) => {
              setDialog(null)
              changed(message)
            }}
          />
        )}
        {dialog?.type === 'unblock' && (
          <UnblockDialog
            key="unblock"
            block={dialog.block}
            onCancel={() => setDialog(null)}
            onDone={(message) => {
              setDialog(null)
              changed(message)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
