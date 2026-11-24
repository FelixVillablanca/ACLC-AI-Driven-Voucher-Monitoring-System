import { format } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, FilePen, FileText, Flag, Hourglass, Inbox, Plus, Undo2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatDate, formatMoney, formatTimeAgo, greeting } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { useClerkDashboard } from '../hooks/useClerkDashboard'

/** Status → the pill in the table (agreed flow 2026-11-22: pending = with the Officer, under_review = with the Supervisor). */
const STATUS = {
  draft: { tone: 'neutral', text: 'Draft' },
  pending: { tone: 'primary', text: 'With Accounting' },
  under_review: { tone: 'warning', text: 'With Supervisor' },
  returned: { tone: 'danger', text: '↩ Returned' },
  approved: { tone: 'success', text: '✓ Approved' },
  rejected: { tone: 'danger', text: 'Rejected' },
}

const ROLE_AT_TIME = { accounting_officer: 'Accounting', supervisor_manager: 'Supervisor' }

/**
 * ACCOUNTING CLERK LANDING PAGE (Framer LolF6YFo5, Phase 6 dashboard on top of the Phase 3 voucher table).
 * Real numbers only, from GET /api/v1/clerk/dashboard, for the company in the switcher.
 * Differences from the frame (real-data rule): "Approved in <month>" says "approved", not "paid out"
 * (payments aren't tracked); the "AI checks every voucher" card is left out (no AI service yet); the
 * search is on My vouchers (not in the top bar). Rows open the voucher; Fix & resubmit opens its form.
 */
export default function ClerkDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const { status, data, error, retry } = useClerkDashboard()

  const subtitle = [data?.department, data?.company?.name, formatDate(new Date(), 'EEEE, MMM d, yyyy')].filter(Boolean).join(' · ')

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-[22px] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-page-title">
            {greeting()}
            {user?.first_name ? `, ${user.first_name}` : ''}
          </h1>
          <p className="text-body text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {data?.counts.drafts > 0 && (
            <Link
              to={`${PATHS.CLERK_VOUCHERS}?view=draft`}
              className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <FilePen className="size-4" aria-hidden="true" /> Continue draft ({data.counts.drafts})
            </Link>
          )}
          <Link
            to={PATHS.CLERK_VOUCHER_NEW}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden="true" /> Create voucher
          </Link>
        </div>
      </div>

      {status === 'loading' && <Skeleton />}

      {status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState title="Couldn't load your dashboard" message={error.message} requestId={error.requestId} onRetry={retry} />
        </div>
      )}

      {status === 'success' && <Content data={data} />}
    </div>
  )
}

function Content({ data }) {
  const { counts, approved_this_month: approved } = data
  const inReview = counts.with_officer + counts.with_supervisor
  const monthName = format(new Date(`${approved.month}T00:00:00`), 'MMMM')

  return (
    <>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Drafts"
          icon={FilePen}
          value={counts.drafts}
          caption={counts.drafts ? `Not yet submitted · ${formatMoney(data.drafts_total)}` : 'Nothing waiting to be submitted'}
        />
        <Stat
          label="In review"
          icon={Hourglass}
          value={inReview}
          caption={
            inReview
              ? `${counts.with_officer} with Accounting · ${counts.with_supervisor} with Supervisor`
              : 'Nothing waiting for a reviewer'
          }
        />
        <Stat
          label="Returned to you"
          icon={Undo2}
          value={counts.returned}
          tone={counts.returned ? 'warning' : undefined}
          caption={counts.returned ? 'Need your changes to resubmit' : 'Nothing sent back'}
        />
        <Stat
          label={`Approved in ${monthName}`}
          icon={CheckCircle2}
          value={approved.count}
          tone={approved.count ? 'success' : undefined}
          caption={approved.count ? `${formatMoney(approved.total)} approved` : 'None approved yet this month'}
        />
      </div>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <RecentVouchers rows={data.recent} total={counts.all} />
        <NeedsAttention rows={data.needs_attention} />
      </div>
    </>
  )
}

const TONES = { warning: 'text-warning', success: 'text-success' }

function Stat({ label, icon: Icon, value, caption, tone }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <p className="text-caption">{label}</p>
        <Icon className={cn('size-4 text-muted-foreground', tone && TONES[tone])} aria-hidden="true" />
      </div>
      <p className={cn('text-stat-value', tone && value > 0 && TONES[tone])}>{value}</p>
      <p className="text-caption">{caption}</p>
    </div>
  )
}

function RecentVouchers({ rows, total }) {
  const navigate = useNavigate()
  return (
    <section aria-labelledby="recent-title" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2.5 border-b px-4 py-3">
        <h2 id="recent-title" className="text-card-title">
          My recent vouchers
        </h2>
        {total > 0 && (
          <Link to={PATHS.CLERK_VOUCHERS} className="text-auth-link text-primary hover:underline">
            View all {total} →
          </Link>
        )}
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No vouchers yet"
          description="Vouchers you create in this company show up here."
          action={
            <Link
              to={PATHS.CLERK_VOUCHER_NEW}
              className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" aria-hidden="true" /> Create voucher
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="text-table-head border-b bg-muted text-muted-foreground">
                <th scope="col" className="px-4 py-2">
                  Voucher · payee
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-2">
                  Status
                </th>
                <th scope="col" className="px-4 py-2">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => {
                const pill = STATUS[v.status] ?? { tone: 'neutral', text: v.status }
                return (
                  <tr
                    key={v.id}
                    onClick={() => navigate(`${PATHS.CLERK_VOUCHERS}/${v.id}`)}
                    className="cursor-pointer border-b last:border-b-0 hover:bg-primary-faint"
                  >
                    <td className="px-4 py-[9px]">
                      <span className="text-body-strong flex flex-wrap items-center gap-1.5">
                        {v.voucher_number ?? <span className="text-caption">Draft · no number yet</span>}
                        {v.ai_flagged && (
                          <span className="text-badge flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-danger">
                            <Flag className="size-3" aria-hidden="true" /> AI flagged
                          </span>
                        )}
                      </span>
                      <span className="text-caption block">{[v.payee_name, v.category].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td className="text-body-strong px-4 py-[9px] text-right whitespace-nowrap tabular-nums">{formatMoney(v.amount)}</td>
                    <td className="px-4 py-[9px]">
                      <Pill tone={pill.tone}>{pill.text}</Pill>
                    </td>
                    <td className="text-caption w-[96px] px-4 py-[9px] whitespace-nowrap">
                      {v.updated_at ? updatedText(v.updated_at) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function NeedsAttention({ rows }) {
  return (
    <section
      aria-labelledby="attention-title"
      className="flex w-full flex-col overflow-hidden rounded-xl border bg-card lg:w-[340px] lg:shrink-0"
    >
      <header className="flex items-center justify-between gap-2.5 border-b px-4 py-3">
        <h2 id="attention-title" className="text-card-title">
          Needs your attention
        </h2>
        {rows.length > 0 && <Pill tone="danger">{rows.length}</Pill>}
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing to fix"
          description="Vouchers a reviewer sends back to you show up here, with their note."
          className="p-8"
        />
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 border-b px-4 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-strong">{r.voucher_number}</span>
                <Pill tone="danger">Returned</Pill>
              </div>
              <p className="text-caption">
                {[r.returned_by, ROLE_AT_TIME[r.returned_by_role]].filter(Boolean).join(' · ') || 'A reviewer'}
                {r.returned_at && ` · ${formatTimeAgo(r.returned_at)}`}
              </p>
              {r.remarks && <p className="text-body rounded-lg bg-muted px-3 py-2">“{r.remarks}”</p>}
              <Link to={`${PATHS.CLERK_VOUCHERS}/${r.id}/edit`} className="text-auth-link w-fit text-primary hover:underline">
                Fix &amp; resubmit →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** "1h ago" / "Yesterday" / "Nov 6" */
function updatedText(value) {
  const date = new Date(value)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days < 1) return formatTimeAgo(date)
  if (days < 2) return 'Yesterday'
  return format(date, 'MMM d')
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-7 w-10 animate-pulse rounded bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3.5 lg:flex-row">
        <div className="h-64 flex-1 animate-pulse rounded-xl border bg-card" />
        <div className="h-64 w-full animate-pulse rounded-xl border bg-card lg:w-[340px]" />
      </div>
    </div>
  )
}
