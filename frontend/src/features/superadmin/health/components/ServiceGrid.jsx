import { formatBytes, formatDate, formatNumber, formatTimeAgo, plural } from '@/lib/formatters'
import { SERVICES, TASK_LABELS, formatMs } from '../utils'
import ServiceCard from './ServiceCard'

/**
 * The 6 service cards in 2 rows (Framer m80KDanOj), filled from REAL checks. When something isn't
 * known yet (no history recorded, ML service not set up) the card says so instead of a number.
 *   services: the server's `services`   checking: SH1   onOpenJobs: SH4
 */
export default function ServiceGrid({ services, checking, checkedAt, onOpenJobs }) {
  const s = services
  const content = {
    web: {
      value: s.web.uptime_30d != null ? `${s.web.uptime_30d}%` : '—',
      caption:
        s.web.uptime_30d != null
          ? // the number of checks behind the %: with only a few, each new minute moves it a lot
            `Up time, last 30 days (${plural(s.web.uptime_checks ?? 0, 'check', 'checks')}${
              (s.web.uptime_checks ?? 0) < 60 ? ', still settling' : ''
            })${s.web.latency_ms != null ? ` · answers in ${formatMs(s.web.latency_ms)}` : ''}`
          : 'No history yet: the scheduler records a check every minute',
    },
    database: {
      value: s.database.disk_used_pct != null ? `${s.database.disk_used_pct}%` : formatBytes(s.database.size_bytes),
      caption: [
        s.database.disk_used_pct != null &&
          `Server disk used${s.database.disk_total_bytes ? ` of ${formatBytes(s.database.disk_total_bytes)}` : ''}`,
        s.database.size_bytes != null && `database ${formatBytes(s.database.size_bytes)}`,
        s.database.connections != null && plural(s.database.connections, 'open connection', 'open connections'),
      ]
        .filter(Boolean)
        .join(' · '),
    },
    queue: {
      value: s.queue.failed > 0 ? `${formatNumber(s.queue.failed)} failed` : `${formatNumber(s.queue.waiting)} waiting`,
      caption: `${formatNumber(s.queue.waiting)} waiting · ${formatNumber(s.queue.running)} running · ${formatNumber(s.queue.done_today)} done today`,
    },
    scheduler: {
      value: s.scheduler.last_run_at ? formatTimeAgo(s.scheduler.last_run_at) : 'Never',
      caption: s.scheduler.last_run_at
        ? `Last run${
            s.scheduler.next?.length
              ? ` · next: ${s.scheduler.next.map((t) => `${TASK_LABELS[t.name] ?? t.name} ${formatDate(t.next, 'MMM d, h:mm a')}`).join(', ')}`
              : ''
          }`
        : 'Not running: start it with dev.ps1 (php artisan schedule:work)',
    },
    ml: {
      value: s.ml.status === 'not_configured' ? '—' : formatMs(s.ml.latency_ms),
      caption: s.ml.status === 'not_configured' ? 'Arrives in Phase 5 (ML_SERVICE_URL isn’t set)' : 'Answer time',
    },
    backup: {
      value: s.backup.current ? 'Backing up…' : s.backup.last_success_at ? formatDate(s.backup.last_success_at, 'h:mm a') : 'None yet',
      caption: s.backup.current
        ? `Started ${formatTimeAgo(s.backup.current.started_at)} · you can leave this page`
        : s.backup.last_success_at
          ? `Last good backup ${formatDate(s.backup.last_success_at, 'MMM d')}${s.backup.last_size_bytes ? ` · ${formatBytes(s.backup.last_size_bytes)}` : ''} · next at ${s.backup.nightly_at}`
          : `No good backup yet · next at ${s.backup.nightly_at}`,
    },
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SERVICES.map((meta) => (
        <ServiceCard
          key={meta.key}
          service={meta.key}
          icon={meta.icon}
          label={meta.label}
          status={s[meta.key].status}
          extra={{
            running: Boolean(s.backup.current) && meta.key === 'backup',
          }}
          value={content[meta.key].value}
          caption={content[meta.key].caption}
          checking={checking}
          checkedAt={checkedAt}
          onOpen={meta.key === 'queue' ? onOpenJobs : undefined}
        />
      ))}
    </div>
  )
}
