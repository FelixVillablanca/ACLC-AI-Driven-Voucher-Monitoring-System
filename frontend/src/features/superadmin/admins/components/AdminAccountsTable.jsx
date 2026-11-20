import { SearchX, Users } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { createdText, lastSignInText, rolePill, statusPill } from '../utils'
import AdminRowMenu from './AdminRowMenu'

/** Column widths from the frame: Name 250 · Email 260 · Role 130 · Status 110 · Last sign-in 170 · Created · ⋯ 40 */
const GRID = 'grid grid-cols-[250px_260px_130px_110px_170px_minmax(110px,1fr)_40px] items-center gap-x-0 px-[18px]'

/**
 * The accounts table (Framer bxGFPLOVN): Muted header row, one row per account,
 * and a Muted footer with "Showing 1–6 of 6 accounts" and the pager.
 * On narrow screens the table scrolls sideways inside its card (the page itself never does).
 */
export default function AdminAccountsTable({ list, filtered, onClearFilters, onPage, onAction }) {
  const meta = list.status === 'success' ? list.meta : null

  return (
    <section aria-label="Admin accounts" className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div role="row" className={cn(GRID, 'border-b bg-muted py-2.5')}>
            {['Name', 'Email', 'Role', 'Status', 'Last sign-in', 'Created'].map((head) => (
              <span key={head} role="columnheader" className="text-table-head text-muted-foreground">
                {head}
              </span>
            ))}
            <span aria-hidden="true" />
          </div>

          {list.status === 'loading' && <SkeletonRows />}

          {list.status === 'success' &&
            list.accounts.map((account) => <AccountRow key={account.id} account={account} onAction={onAction} />)}
        </div>
      </div>

      {list.status === 'error' && (
        <ErrorState
          title="Couldn't load the accounts"
          message={list.error.message}
          requestId={list.error.requestId}
          onRetry={list.reload}
        />
      )}

      {list.status === 'success' && list.accounts.length === 0 && (
        <EmptyState
          icon={filtered ? SearchX : Users}
          title={filtered ? 'No accounts match' : 'No accounts yet'}
          description={filtered ? 'Try another name or email, or clear the filters.' : 'Add the first Admin with “+ Add admin”.'}
          action={
            filtered && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Clear filters
              </button>
            )
          }
        />
      )}

      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-[18px] py-2.5">
          <p className="text-caption">
            Showing {meta.from}–{meta.to} of {plural(meta.total, 'account', 'accounts')}
          </p>
          <nav aria-label="Pages" className="text-caption flex items-center gap-2">
            <PagerButton disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
              ‹ Previous
            </PagerButton>
            <span aria-hidden="true">·</span>
            <span aria-current="page">
              Page {meta.current_page} of {meta.last_page}
            </span>
            <span aria-hidden="true">·</span>
            <PagerButton disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
              Next ›
            </PagerButton>
          </nav>
        </div>
      )}
    </section>
  )
}

function AccountRow({ account, onAction }) {
  const inactive = account.status === 'inactive'
  const role = rolePill(account.role)
  const status = statusPill(account.status)

  return (
    <div role="row" className={cn(GRID, 'border-b py-2.5 last:border-b-0', inactive && 'bg-muted')}>
      <div role="cell" className="flex min-w-0 items-center gap-2.5 pr-3">
        <span
          aria-hidden="true"
          className={cn(
            'text-badge flex size-8 shrink-0 items-center justify-center rounded-full',
            account.is_you
              ? 'bg-primary text-primary-foreground'
              : inactive
                ? 'border bg-muted text-muted-foreground'
                : 'bg-primary-soft text-primary',
          )}
        >
          {formatInitials(account)}
        </span>
        <span className="text-body-strong truncate" title={account.company ? `Runs ${account.company}` : undefined}>
          {account.full_name}
          {account.is_you && ' (you)'}
        </span>
      </div>
      <span role="cell" className="text-body truncate pr-3" title={account.email}>
        {account.email}
      </span>
      <span role="cell">
        <Pill tone={role.tone} className={role.className}>
          {role.text}
        </Pill>
      </span>
      <span role="cell">
        <Pill tone={status.tone}>{status.text}</Pill>
      </span>
      <span role="cell" className="text-body">
        {lastSignInText(account)}
      </span>
      <span role="cell" className="text-caption">
        {createdText(account.created_at)}
      </span>
      <span role="cell" className="flex justify-end">
        <AdminRowMenu account={account} onChoose={onAction} />
      </span>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div role="status" aria-label="Loading accounts">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn(GRID, 'border-b py-3 last:border-b-0')} aria-hidden="true">
          <div className="flex items-center gap-2.5">
            <div className="size-8 animate-pulse rounded-full bg-border/70" />
            <div className="h-4 w-32 animate-pulse rounded bg-border/70" />
          </div>
          <div className="h-4 w-44 animate-pulse rounded bg-border/70" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-border/70" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-border/70" />
          <div className="h-4 w-20 animate-pulse rounded bg-border/70" />
          <div className="h-3 w-20 animate-pulse rounded bg-border/70" />
          <span />
        </div>
      ))}
    </div>
  )
}

function PagerButton({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground"
    >
      {children}
    </button>
  )
}
