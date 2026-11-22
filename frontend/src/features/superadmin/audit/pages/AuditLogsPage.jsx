import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import { useDebounce } from '@/hooks/useDebounce'
import { formatNumber, formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getAuditOptions, unblockIp } from '../api'
import ActiveFilters from '../components/ActiveFilters'
import AuditFilterBar from '../components/AuditFilterBar'
import AuditSummaryCards from '../components/AuditSummaryCards'
import AuditTable from '../components/AuditTable'
import BlockIpDialog from '../components/BlockIpDialog'
import EventDetailPanel from '../components/EventDetailPanel'
import ExportAuditDialog from '../components/ExportAuditDialog'
import IpBanner from '../components/IpBanner'
import NoResults from '../components/NoResults'
import { useAuditLogs } from '../hooks/useAuditLogs'
import { announceAuditChanged, looksLikeIp, presetOf, rangeLabel, readFilters, writeFilters } from '../utils'

/**
 * The Super Admin's Audit logs tab (Framer EJ0asP2ZH / iVFf6FzsH) with
 *   AL1 Export CSV · AL2 IP search + Block this IP · AL3 company filter · AL4 action filter ·
 *   AL5 date range · AL6 Sensitive only · AL7 event details · AL8 block confirm · AL9 no results.
 *
 * The ADDRESS holds every filter, the page and the open event
 * (?q=180.190.77.4&company=3&action=login_failed&from=2026-11-12&to=2026-11-19&sensitive=1&page=2&event=48213),
 * so Back, refresh and "Copy link" all show the same thing. The log itself can never be edited here.
 */
export default function AuditLogsPage() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const page = Number(params.get('page')) || 1
  const eventId = Number(params.get('event')) || null

  const list = useAuditLogs(filters, page)
  const [options, setOptions] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [overlay, setOverlay] = useState(null) // 'export' | 'block' | { unblock: block }
  const [unblocking, setUnblocking] = useState(false)

  useEffect(() => {
    getAuditOptions()
      .then(setOptions)
      .catch(() => setOptions({ companies: [], groups: [] })) // the filters still work, just without names
  }, [])

  // The search box updates as you type; the address (and the server) after a 300 ms pause
  const [searchText, setSearchText] = useState(filters.search)
  const debounced = useDebounce(searchText.trim(), 300)

  const update = useCallback(
    (changes) => setParams((p) => writeFilters(p, changes), { replace: true }),
    [setParams],
  )
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

  useEffect(() => {
    if (debounced !== filters.search) update({ search: debounced })
  }, [debounced, filters.search, update])

  const onFilters = (changes) => {
    if ('search' in changes) setSearchText(changes.search)
    update(changes)
  }
  const clearAll = () => {
    setSearchText('')
    setParams(new URLSearchParams(), { replace: true })
  }

  const meta = list.meta
  const summary = meta?.summary
  const ip = meta?.ip && meta.ip.ip === filters.search ? meta.ip : null
  const isLive = page === 1 && (!filters.to || filters.to === format(new Date(), 'yyyy-MM-dd'))

  const confirmUnblock = async () => {
    setUnblocking(true)
    try {
      await unblockIp(overlay.unblock.id)
      toast.success(`${filters.search} is unblocked. Sign-ins from it are allowed again.`)
      setOverlay(null)
      announceAuditChanged()
    } catch (err) {
      toast.error(err.message)
      if (err.status === 409) announceAuditChanged() // someone else already unblocked it
      setOverlay(null)
    } finally {
      setUnblocking(false)
    }
  }

  const moreFromPerson = (entry) => {
    const day = format(parseISO(entry.at), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    setSearchText(entry.who.email ?? entry.who.name)
    setParams(
      (p) => {
        writeFilters(p, { search: entry.who.email ?? entry.who.name, companies: [], actions: [], from: day, to: day === today ? null : day, sensitive: false })
        p.delete('event')
        return p
      },
      { replace: true },
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">Audit logs</h1>
          <p className="text-body text-muted-foreground">Every action on the platform, in every company. Entries can’t be edited or deleted.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            role="status"
            className={cn('text-badge rounded-full px-2.5 py-1', isLive ? 'bg-success-soft text-success' : 'border bg-muted text-muted-foreground')}
          >
            {isLive ? `● Live · updated ${list.updatedAt ? formatTimeAgo(list.updatedAt) : '…'}` : 'Showing past dates'}
          </span>
          <button
            type="button"
            onClick={() => setOverlay('export')}
            disabled={!meta}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      <AuditSummaryCards summary={summary} sensitiveOn={filters.sensitive} onSensitive={() => onFilters({ sensitive: !filters.sensitive })} />

      <div className="overflow-hidden rounded-xl border bg-card">
        <AuditFilterBar
          searchText={searchText}
          onSearchText={setSearchText}
          filters={filters}
          options={options}
          facets={meta?.facets}
          onChange={onFilters}
        />
        <ActiveFilters
          filters={filters}
          options={options}
          total={list.status === 'success' ? meta?.total : null}
          eventsToday={summary?.events_today ?? 0}
          onChange={onFilters}
          onClearAll={clearAll}
        />
        {ip && looksLikeIp(filters.search) && (
          <IpBanner ip={ip} onBlock={() => setOverlay('block')} onUnblock={(block) => setOverlay({ unblock: block })} unblocking={unblocking} />
        )}

        {list.status === 'loading' && <TableSkeleton />}
        {list.status === 'error' && (
          <ErrorState title="Couldn't load the audit log" message={list.error.message} requestId={list.error.requestId} onRetry={list.reload} />
        )}
        {list.status === 'success' && list.entries.length === 0 && (
          <NoResults filters={filters} options={options} onAllCompanies={() => onFilters({ companies: [] })} onClear={clearAll} />
        )}
        {list.status === 'success' && list.entries.length > 0 && (
          <AuditTable
            entries={list.entries}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
            onOpen={(id) => setParam('event', id)}
            highlightIp={looksLikeIp(filters.search) ? filters.search : null}
          />
        )}

        {meta && list.status !== 'error' && (
          <div className="text-caption flex flex-wrap items-center justify-between gap-2 bg-muted px-4 py-3">
            <p>
              {meta.total === 0
                ? `0 events · ${rangeLabel(filters).toLowerCase()}`
                : `Showing ${formatNumber(meta.from)}–${formatNumber(meta.to)} of ${formatNumber(meta.total)} ${meta.total === 1 ? 'event' : 'events'}${
                    presetOf(filters) === 'today' ? ' today' : ` · ${rangeLabel(filters).toLowerCase()}`
                  } · newest first`}
            </p>
            {meta.last_page > 1 && (
              <nav aria-label="Pages" className="flex items-center gap-2">
                <PagerButton disabled={page <= 1} onClick={() => setParam('page', page - 1 > 1 ? page - 1 : null)}>
                  ‹ Newer
                </PagerButton>
                <span aria-current="page">
                  Page {page} of {formatNumber(meta.last_page)}
                </span>
                <PagerButton disabled={page >= meta.last_page} onClick={() => setParam('page', page + 1)}>
                  Older ›
                </PagerButton>
              </nav>
            )}
          </div>
        )}
      </div>

      <EventDetailPanel eventId={eventId} onClose={() => setParam('event', null)} onMoreFromPerson={moreFromPerson} />

      <AnimatePresence>
        {overlay === 'export' && (
          <ExportAuditDialog
            key="export"
            filters={filters}
            counts={{ all: meta?.range_counts?.all ?? 0, sensitive: meta?.range_counts?.sensitive ?? 0, filters: meta?.total ?? 0 }}
            onCancel={() => setOverlay(null)}
            onDone={(message) => {
              setOverlay(null)
              toast.success(message)
              announceAuditChanged() // the export itself is now in the log
            }}
          />
        )}
        {overlay === 'block' && (
          <BlockIpDialog
            key="block"
            ip={filters.search}
            onCancel={() => setOverlay(null)}
            onDone={(message) => {
              setOverlay(null)
              toast.success(message)
              announceAuditChanged()
            }}
          />
        )}
        {overlay?.unblock && (
          <ConfirmDialog
            key="unblock"
            title={`Unblock ${overlay.unblock.ip_address ?? filters.search}?`}
            description="Sign-ins from this address will be allowed again. This is recorded in the audit log."
            confirmLabel="Unblock"
            busy={unblocking}
            onConfirm={confirmUnblock}
            onCancel={() => setOverlay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PagerButton({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function TableSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading the audit log">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5">
          <div className="h-8 w-16 animate-pulse rounded bg-border/70" />
          <div className="size-8 animate-pulse rounded-full bg-border/70" />
          <div className="h-3.5 w-32 animate-pulse rounded bg-border/70" />
          <div className="h-5 w-28 animate-pulse rounded-full bg-border/70" />
          <div className="ml-auto h-3.5 w-24 animate-pulse rounded bg-border/70" />
        </div>
      ))}
    </div>
  )
}
