import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { RETRY_JOBS_SEARCH } from '@/features/superadmin/jobs'
import { formatDate, formatTimeAgo, plural } from '@/lib/formatters'

/**
 * "Jobs that need a look · N" (Framer m80KDanOj): jobs retrying on their own (amber) and jobs that
 * gave up (red). A failed row opens SH5; "↻ Retry failed (N)" opens the Retry failed jobs window (SH6).
 *   retrying: [{ id, name, attempts, max_tries, next_try_at, running }]   failed: { jobs, total }
 */
export default function JobsNeedLook({ retrying, failed, onOpenJob }) {
  const retryable = failed.jobs.filter((j) => j.retryable)
  const count = retrying.length + failed.total

  return (
    <section aria-labelledby="jobs-look-title" className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-2 px-[18px] pt-4 pb-3">
        <div>
          <h2 id="jobs-look-title" className="text-card-title">
            Jobs that need a look · {count}
          </h2>
          <p className="text-caption">Background jobs still retrying on their own, and ones that gave up.</p>
        </div>
        {retryable.length > 0 && (
          <Link
            to={{ search: RETRY_JOBS_SEARCH }}
            className="text-auth-link flex items-center gap-1 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" /> Retry failed ({retryable.length})
          </Link>
        )}
      </header>

      {count === 0 ? (
        <div className="flex items-center gap-2.5 border-t px-[18px] py-6">
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          <p className="text-body">Nothing to look at: every background job finished.</p>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-table-head h-9 border-y bg-muted text-left text-muted-foreground">
              <th scope="col" className="pl-[18px] font-semibold">
                Job
              </th>
              <th scope="col" className="w-28 px-3 font-semibold">
                Status
              </th>
              <th scope="col" className="w-44 px-3 font-semibold">
                Tries
              </th>
              <th scope="col" className="w-8 pr-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {retrying.map((j) => (
              <tr key={`r${j.id}`} className="border-b last:border-b-0">
                <td className="py-2.5 pl-[18px]">
                  <p className="text-body-strong">{j.name}</p>
                  <p className="text-caption">Waiting for another try</p>
                </td>
                <td className="px-3">
                  <Pill tone="warning">{j.running ? 'Running' : 'Retrying'}</Pill>
                </td>
                <td className="text-caption px-3">
                  {j.attempts}
                  {j.max_tries ? ` of ${j.max_tries}` : ''}
                  {j.next_try_at && ` · next at ${formatDate(j.next_try_at, 'h:mm a')}`}
                </td>
                <td />
              </tr>
            ))}
            {failed.jobs.slice(0, 5).map((j) => (
              <tr key={j.id} onClick={() => onOpenJob(j.id)} className="cursor-pointer border-b last:border-b-0 hover:bg-muted/60">
                <td className="py-2.5 pl-[18px]">
                  <p className="text-body-strong">{j.name}</p>
                  <p className="text-caption truncate">{[j.subject, j.error].filter(Boolean).join(' · ')}</p>
                </td>
                <td className="px-3">
                  <Pill tone="danger">Failed</Pill>
                </td>
                <td className="text-caption px-3">
                  {j.max_tries ? `${j.max_tries} of ${j.max_tries} · ` : ''}gave up {formatTimeAgo(j.failed_at)}
                </td>
                <td className="pr-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenJob(j.id)
                    }}
                    aria-label={`Open ${j.name}`}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {failed.total > 5 && (
        <p className="text-caption border-t px-[18px] py-2.5">
          And {plural(failed.total - 5, 'more failed job', 'more failed jobs')}: open “Retry failed” to see them all.
        </p>
      )}
    </section>
  )
}
