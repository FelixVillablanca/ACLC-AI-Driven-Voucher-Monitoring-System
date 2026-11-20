import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Flag, KeyRound, Loader2, Pencil, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS } from '@/lib/constants'
import { formatInitials, formatTimeAgo, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getAdminActivity } from '../api'
import { useAdminDetail } from '../hooks/useAdminDetail'
import { dateText, daysAgoText, rolePill, statusPill } from '../utils'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'company', label: 'Company' },
  { key: 'activity', label: 'Activity' },
]

/**
 * Profile side panel (A8, frame lsRiMKhBC, 460px): details, two-step, security facts, their company
 * and what they did lately. Footer: Send password reset / Edit details (when allowed).
 * `onAction(key, account)` opens the same dialogs as the ⋯ menu.
 */
export default function AdminProfilePanel({ accountId, onClose, onAction }) {
  return (
    <AnimatePresence>
      {accountId && <Panel key={accountId} accountId={accountId} onClose={onClose} onAction={onAction} />}
    </AnimatePresence>
  )
}

function Panel({ accountId, onClose, onAction }) {
  const detail = useAdminDetail(accountId)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const account = detail.account

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-foreground/45"
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Account profile"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card text-foreground shadow-2xl sm:w-[460px]"
      >
        {detail.status === 'loading' && (
          <div role="status" className="flex flex-1 items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading the profile…</span>
          </div>
        )}
        {detail.status === 'error' && (
          <div className="flex flex-1 flex-col">
            <div className="flex justify-end p-3">
              <CloseButton onClick={onClose} />
            </div>
            <ErrorState
              title="Couldn't load this profile"
              message={detail.error.message}
              requestId={detail.error.requestId}
              onRetry={detail.reload}
            />
          </div>
        )}

        {account && (
          <>
            <Header account={account} onClose={onClose} />
            <div role="tablist" className="flex gap-5 border-b px-5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    '-mb-px border-b-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    tab === t.key
                      ? 'text-auth-link border-primary text-primary'
                      : 'text-body border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              {tab === 'overview' && (
                <Overview account={account} onAction={onAction} onShowActivity={() => setTab('activity')} />
              )}
              {tab === 'company' && <CompanyTab account={account} />}
              {tab === 'activity' && <ActivityTab accountId={account.id} />}
            </div>

            {(account.actions.reset_password || account.actions.edit) && (
              <footer className="flex flex-wrap justify-end gap-2 border-t bg-muted px-5 py-3.5">
                {account.actions.reset_password && (
                  <button
                    type="button"
                    onClick={() => onAction('reset_password', account)}
                    className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <KeyRound className="size-4" aria-hidden="true" /> Send password reset
                  </button>
                )}
                {account.actions.edit && (
                  <button
                    type="button"
                    onClick={() => onAction('edit', account)}
                    className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Pencil className="size-4" aria-hidden="true" /> Edit details
                  </button>
                )}
              </footer>
            )}
          </>
        )}
      </motion.aside>
    </motion.div>
  )
}

function Header({ account, onClose }) {
  const role = rolePill(account.role)
  const status = statusPill(account.status)
  return (
    <div className="flex items-start gap-3 border-b px-5 pt-5 pb-4">
      <span className="text-badge flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        {formatInitials(account)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div>
          <h2 className="text-card-title truncate">
            {account.full_name}
            {account.is_you && ' (you)'}
          </h2>
          <p className="text-caption truncate">{account.email}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={role.tone} className={role.className}>
            {role.text}
          </Pill>
          <Pill tone={status.tone}>{status.text}</Pill>
          {account.two_factor === 'on' ? (
            <Pill tone="success">Two-step on</Pill>
          ) : account.two_factor === 'required' ? (
            <Pill tone="warning">Two-step required</Pill>
          ) : (
            <Pill tone="neutral">Two-step off</Pill>
          )}
        </div>
      </div>
      <CloseButton onClick={onClose} />
    </div>
  )
}

function Overview({ account, onAction, onShowActivity }) {
  const last = account.last_sign_in
  return (
    <>
      <Section title="Details">
        <dl className="flex flex-col gap-2">
          <Row label="Employee ID">{account.employee_id ?? '—'}</Row>
          <Row label="Created">
            {dateText(account.created_at)}
            {account.created_by && ` by ${account.created_by}`}
          </Row>
          <Row label="Last sign-in">
            {last
              ? `${formatTimeAgo(last.at)}${last.device ? ` · ${last.device}` : ''}`
              : account.status === 'pending'
                ? 'Never (invitation not used yet)'
                : 'Never'}
          </Row>
          {account.personal_email && <Row label="Personal email">{account.personal_email}</Row>}
        </dl>
      </Section>

      <TwoStepBox account={account} onAction={onAction} />

      <p className="text-caption">
        {account.password_changed_at
          ? `Password changed ${daysAgoText(account.password_changed_at)}`
          : 'Password never changed'}{' '}
        · {plural(account.failed_sign_ins_30d, 'failed sign-in', 'failed sign-ins')} in 30 days
      </p>

      <Section title="Recent activity">
        <ActivityList items={account.recent_activity} empty="Nothing yet." />
        {account.recent_activity.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={onShowActivity}
              className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              See all activity
            </button>
            <Link
              to={PATHS.SUPERADMIN_AUDIT_LOGS}
              className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              View all in Audit logs →
            </Link>
          </div>
        )}
      </Section>
    </>
  )
}

function TwoStepBox({ account, onAction }) {
  const d = account.two_factor_details
  if (account.two_factor === 'on') {
    return (
      <div className="flex items-start gap-2.5 rounded-[10px] border border-success/20 bg-success-soft px-3.5 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-caption">
          <span className="text-body-strong block text-foreground">Two-step sign-in is on</span>
          Since {dateText(d.confirmed_at)} · {plural(d.recovery_codes_left ?? 0, 'backup code', 'backup codes')} left
        </p>
      </div>
    )
  }
  if (account.two_factor === 'required') {
    return (
      <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/20 bg-warning-soft px-3.5 py-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-caption">
          <span className="text-body-strong block text-foreground">Two-step sign-in is required</span>
          They’ll set it up at their next sign-in (deadline {dateText(d.setup_deadline)}).
        </p>
      </div>
    )
  }
  if (account.two_factor === 'not_set_up') return null
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/20 bg-warning-soft px-3.5 py-3">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-body-strong">Two-step sign-in is off</p>
        <p className="text-caption">
          {account.role === 'super_admin'
            ? 'Super Admins can change the whole platform.'
            : 'Admins can change users and access in their company.'}{' '}
          A second check at sign-in protects that.
        </p>
      </div>
      {account.actions.require_two_factor && (
        <button
          type="button"
          onClick={() => onAction('require_two_factor', account)}
          className="text-auth-link shrink-0 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Require it
        </button>
      )}
    </div>
  )
}

function CompanyTab({ account }) {
  if (account.role === 'super_admin') {
    return (
      <EmptyState
        title="All companies"
        description="Super Admins work outside every company: they run the whole platform."
      />
    )
  }
  if (!account.company)
    return <EmptyState title="No company" description="Edit their details to give them a company." />
  return (
    <Section title="Manages 1 company">
      <div className="flex items-center gap-3 rounded-[10px] border px-3.5 py-3">
        <span className="text-badge flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          {account.company.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase()}
        </span>
        <div>
          <p className="text-body-strong">{account.company.name}</p>
          <p className="text-caption">{plural(account.company.users_count, 'user', 'users')}</p>
        </div>
      </div>
      <p className="text-caption">Each Admin runs one company. To move them, use Edit details.</p>
    </Section>
  )
}

function ActivityTab({ accountId }) {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null })
  const [more, setMore] = useState(false)

  const load = useCallback(
    (page = 1) =>
      getAdminActivity(accountId, page)
        .then(({ items, meta }) =>
          setState((prev) => ({
            status: 'success',
            items: page === 1 ? items : [...prev.items, ...items],
            meta,
            error: null,
          })),
        )
        .catch((error) => setState((prev) => (page === 1 ? { status: 'error', items: [], meta: null, error } : prev))),
    [accountId],
  )

  useEffect(() => {
    load()
  }, [load])

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        <span className="text-caption">Loading activity…</span>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <ErrorState
        title="Couldn't load the activity"
        message={state.error.message}
        requestId={state.error.requestId}
        onRetry={() => load()}
      />
    )
  }

  const hasMore = state.meta && state.meta.current_page < state.meta.last_page
  return (
    <>
      <ActivityList items={state.items} empty="They haven’t done anything yet." />
      {hasMore && (
        <button
          type="button"
          disabled={more}
          onClick={async () => {
            setMore(true)
            await load(state.meta.current_page + 1)
            setMore(false)
          }}
          className="text-auth-link flex items-center gap-1.5 self-center rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {more && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Load more
        </button>
      )}
    </>
  )
}

function ActivityList({ items, empty }) {
  if (items.length === 0) return <p className="text-caption">{empty}</p>
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0">
          <span className="text-body flex items-start gap-1.5">
            {item.sensitive && <Flag className="mt-1 size-3 shrink-0 text-warning" aria-label="Sensitive" />}
            {item.text}
          </span>
          <span className="text-caption shrink-0">{formatTimeAgo(item.at)}</span>
        </li>
      ))}
    </ul>
  )
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-table-head text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption shrink-0">{label}</dt>
      <dd className="text-body text-right break-all">{children}</dd>
    </div>
  )
}

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}
