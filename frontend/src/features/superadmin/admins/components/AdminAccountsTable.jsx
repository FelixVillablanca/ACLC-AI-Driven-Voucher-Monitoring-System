import { Ban, Check, KeyRound, Minus, RotateCw, SearchX, ShieldCheck, Users } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { dateText, invitationExpiryText, lastSignInText, rolePill, statusPill, twoFactorLook } from '../utils'
import AdminRowMenu from './AdminRowMenu'

/** Column widths from the frame: ☐ 32 · Admin 300 · Role 130 · Two-step 120 · Status 110 · Last sign-in 150 · Created · ⋯ 40 */
const GRID = 'grid grid-cols-[32px_300px_130px_120px_110px_150px_minmax(100px,1fr)_40px] items-center px-[18px]'

/**
 * The Admins table (Framer U7glXUOSF) with:
 *   - tick boxes and the "N selected" bar (A6)
 *   - the amber "Waiting for first sign-in" bar in the Pending view (A5)
 *   - "1 match for “liz” · Clear search" (A3)
 * On narrow screens the table scrolls sideways inside its card (the page itself never does).
 */
export default function AdminAccountsTable({
  list,
  view,
  search,
  selected,
  onToggle,
  onToggleAll,
  onClearSelection,
  onClearSearch,
  onClearFilters,
  onPage,
  onAction,
  onBulk,
  seatsLeft,
}) {
  const meta = list.status === 'success' ? list.meta : null
  const rows = list.accounts
  const pageIds = rows.map((r) => r.id)
  const checkedOnPage = pageIds.filter((id) => selected.has(id)).length
  const allChecked = rows.length > 0 && checkedOnPage === rows.length
  const someChecked = checkedOnPage > 0 && !allChecked
  const pendingRows = rows.filter((r) => r.status === 'pending')

  return (
    <section aria-label="Admin accounts" className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[1040px]">
          <div role="row" className={cn(GRID, 'border-b bg-muted py-2.5')}>
            <span role="columnheader">
              <TickBox
                checked={allChecked}
                mixed={someChecked}
                onChange={() => onToggleAll(pageIds, !allChecked)}
                label="Select all on this page"
                disabled={rows.length === 0}
              />
            </span>
            {['Admin', 'Role', 'Two-step', 'Status', 'Last sign-in', 'Created'].map((head) => (
              <span key={head} role="columnheader" className="text-table-head text-muted-foreground">
                {head}
              </span>
            ))}
            <span aria-hidden="true" />
          </div>

          {view === 'pending' && list.status === 'success' && pendingRows.length > 0 && (
            <PendingBar rows={pendingRows} selected={selected} onAction={onAction} />
          )}

          {list.status === 'loading' && <SkeletonRows />}

          {list.status === 'success' &&
            rows.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                checked={selected.has(account.id)}
                onToggle={() => onToggle(account.id)}
                onAction={onAction}
                seatsLeft={seatsLeft}
              />
            ))}
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

      {list.status === 'success' && rows.length === 0 && (
        <EmptyState
          icon={search || view ? SearchX : Users}
          title={search ? `No account matches “${search}”` : view ? 'Nobody in this view' : 'No accounts yet'}
          description={search || view ? 'Try another name or email, or show everyone.' : 'Add the first Admin with “+ Add admin”.'}
          action={
            (search || view) && (
              <button
                type="button"
                onClick={onClearFilters}
                className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Show all accounts
              </button>
            )
          }
        />
      )}

      {selected.size > 0 ? (
        <SelectionBar count={selected.size} onBulk={onBulk} onClear={onClearSelection} />
      ) : (
        meta &&
        meta.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-[18px] py-2.5">
            <p className="text-caption">
              {search ? (
                <>
                  {plural(meta.total, 'match', 'matches')} for “{search}” ·{' '}
                  <button
                    type="button"
                    onClick={onClearSearch}
                    className="rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    Clear search to see all {meta.summary?.total_accounts}
                  </button>
                </>
              ) : view === 'pending' ? (
                `${plural(meta.total, 'pending account', 'pending accounts')}${
                  pendingRows.length === 1 ? ` · ${invitationExpiryText(pendingRows[0].invitation_expires_at)}` : ''
                }`
              ) : (
                `Showing ${meta.from}–${meta.to} of ${meta.total}`
              )}
            </p>
            {meta.last_page > 1 && (
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
            )}
          </div>
        )
      )}
    </section>
  )
}

function AccountRow({ account, checked, onToggle, onAction, seatsLeft }) {
  const inactive = account.status === 'inactive'
  const role = rolePill(account.role)
  const status = statusPill(account.status)
  const twoStep = twoFactorLook(account.two_factor)

  return (
    <div role="row" className={cn(GRID, 'border-b py-[9px] last:border-b-0', checked ? 'bg-primary-faint' : inactive && 'bg-muted')}>
      <span role="cell">
        <TickBox checked={checked} onChange={onToggle} label={`Select ${account.full_name}`} />
      </span>
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
        <button
          type="button"
          onClick={() => onAction('profile', account)}
          className="min-w-0 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="text-body-strong block truncate hover:underline">
            {account.full_name}
            {account.is_you && ' (you)'}
          </span>
          <span className="text-caption block truncate" title={account.company ? `Runs ${account.company}` : undefined}>
            {account.email}
          </span>
        </button>
      </div>
      <span role="cell">
        <Pill tone={role.tone} className={role.className}>
          {role.text}
        </Pill>
      </span>
      <span role="cell">
        {twoStep.pill ? <Pill tone={twoStep.pill}>{twoStep.text}</Pill> : <span className="text-caption">{twoStep.text}</span>}
      </span>
      <span role="cell">
        <Pill tone={status.tone}>{status.text}</Pill>
      </span>
      <span role="cell" className="text-body">
        {lastSignInText(account)}
      </span>
      <span role="cell" className="text-caption">
        {dateText(account.created_at)}
      </span>
      <span role="cell" className="flex justify-end">
        <AdminRowMenu account={account} seatsLeft={seatsLeft} onChoose={onAction} />
      </span>
    </div>
  )
}

/**
 * A5 "Waiting for first sign-in". Its buttons act on ONE pending account: the ticked one,
 * or the only one in the list. With several, tick the one you mean first.
 */
function PendingBar({ rows, selected, onAction }) {
  const ticked = rows.filter((r) => selected.has(r.id))
  const target = ticked.length === 1 ? ticked[0] : rows.length === 1 && ticked.length === 0 ? rows[0] : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-warning-soft px-[18px] py-3">
      <div className="min-w-0 flex-1">
        <p className="text-badge text-warning">Waiting for first sign-in</p>
        <p className="text-caption">
          Pending accounts were invited but haven’t set a password yet. Their link expires 72 hours after it was sent.
          {!target && ' Tick one account to resend or cancel its invitation.'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={!target?.actions.cancel_invitation}
          onClick={() => onAction('cancel_invitation', target)}
          className="text-body-strong h-[34px] rounded-lg border bg-card px-3 text-danger outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel invite
        </button>
        <button
          type="button"
          disabled={!target?.actions.resend_invitation}
          onClick={() => onAction('resend_invitation', target)}
          className="text-auth-button flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCw className="size-3.5" aria-hidden="true" /> Resend sign-in details
        </button>
      </div>
    </div>
  )
}

/** A6: replaces the footer while rows are ticked. */
function SelectionBar({ count, onBulk, onClear }) {
  const button =
    'text-body-strong flex h-8 items-center gap-1.5 rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50'
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-t bg-primary-faint px-[18px] py-2.5"
      role="toolbar"
      aria-label="Selected accounts"
    >
      <span className="text-body-strong mr-2 text-primary">{count} selected</span>
      <button type="button" onClick={() => onBulk('password_reset')} className={button}>
        <KeyRound className="size-4" aria-hidden="true" /> Send password reset
      </button>
      <button type="button" onClick={() => onBulk('require_two_factor')} className={button}>
        <ShieldCheck className="size-4" aria-hidden="true" /> Require two-step
      </button>
      <button type="button" onClick={() => onBulk('deactivate')} className={cn(button, 'text-danger')}>
        <Ban className="size-4" aria-hidden="true" /> Deactivate
      </button>
      <button
        type="button"
        onClick={onClear}
        className="text-auth-link ml-auto rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Clear selection
      </button>
    </div>
  )
}

function TickBox({ checked, mixed = false, onChange, label, disabled = false }) {
  return (
    <label className={cn('flex size-5 items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
          checked || mixed ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : mixed ? <Minus className="size-3" strokeWidth={3} /> : null}
      </span>
    </label>
  )
}

function SkeletonRows() {
  return (
    <div role="status" aria-label="Loading accounts">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={cn(GRID, 'border-b py-3 last:border-b-0')} aria-hidden="true">
          <div className="size-4 animate-pulse rounded bg-border/70" />
          <div className="flex items-center gap-2.5">
            <div className="size-8 animate-pulse rounded-full bg-border/70" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-32 animate-pulse rounded bg-border/70" />
              <div className="h-3 w-44 animate-pulse rounded bg-border/70" />
            </div>
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-border/70" />
          <div className="h-5 w-12 animate-pulse rounded-full bg-border/70" />
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
