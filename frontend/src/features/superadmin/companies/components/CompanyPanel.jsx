import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Building2, Loader2, PlayCircle, RotateCcw, Users, X } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { PATHS, ROLE_LABELS } from '@/lib/constants'
import { formatDate, formatNumber, formatTimeAgo, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { listCompanyDepartments, listCompanyHistory, listCompanyUsers } from '../api'
import { useCompanyDetail } from '../hooks/useCompanyDetail'
import { companyInitials, companySubtitle, suspendedText, tileTone } from '../utils'
import { StatusPill } from './CompanyCard'

/**
 * Company side panel (C8, frame a17W5hpkA, 480px from the right): header with the logo tile, name,
 * status and "type · address · Company ID", then 4 tabs: Overview / Departments N / Users N / History.
 * Footer: "View audit log" + Suspend company (or Reactivate when it's suspended).
 *
 * `companyId` opens it (the page keeps it in the address: ?company=12). `onAction(type, company)`
 * opens the same Suspend / Reactivate dialogs as the cards; they appear on top of the panel and the
 * panel refreshes itself afterwards. Counts and names only: the Super Admin never sees money.
 */
export default function CompanyPanel({ companyId, onClose, onAction }) {
  return (
    <AnimatePresence>
      {companyId && <Panel key={companyId} companyId={companyId} onClose={onClose} onAction={onAction} />}
    </AnimatePresence>
  )
}

function Panel({ companyId, onClose, onAction }) {
  const detail = useCompanyDetail(companyId)
  const [tab, setTab] = useState('overview')
  const company = detail.company

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'departments', label: 'Departments', count: company?.departments_count },
    { key: 'users', label: 'Users', count: company?.users_count },
    { key: 'history', label: 'History' },
  ]

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
        aria-label={company ? company.name : 'Company details'}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card text-foreground shadow-2xl sm:w-[480px]"
      >
        {detail.status === 'loading' && (
          <div role="status" className="flex flex-1 items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading the company…</span>
          </div>
        )}

        {detail.status === 'error' && (
          <div className="flex flex-1 flex-col">
            <div className="flex justify-end p-3">
              <CloseButton onClick={onClose} />
            </div>
            <ErrorState
              title={detail.error.status === 404 ? 'This company no longer exists' : "Couldn't load this company"}
              message={detail.error.status === 404 ? 'It may have been removed. Close this panel to go back to the list.' : detail.error.message}
              requestId={detail.error.requestId}
              onRetry={detail.error.status === 404 ? undefined : detail.reload}
            />
          </div>
        )}

        {company && (
          <>
            <Header company={company} onClose={onClose} />

            <div role="tablist" aria-label="Company sections" className="flex gap-5 overflow-x-auto border-b px-6">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    '-mb-px shrink-0 border-b-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    tab === t.key
                      ? 'text-auth-link border-primary text-primary'
                      : 'text-body border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  {t.count != null && ` ${formatNumber(t.count)}`}
                </button>
              ))}
            </div>

            <div role="tabpanel" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              {tab === 'overview' && <Overview company={company} onSeeDepartments={() => setTab('departments')} />}
              {tab === 'departments' && <DepartmentsTab companyId={company.id} />}
              {tab === 'users' && <UsersTab companyId={company.id} />}
              {tab === 'history' && <HistoryTab companyId={company.id} />}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted px-6 py-3.5">
              <Link
                to={`${PATHS.SUPERADMIN_AUDIT_LOGS}?company=${company.id}`}
                className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                View audit log
              </Link>
              {company.status === 'suspended' ? (
                <button
                  type="button"
                  onClick={() => onAction('reactivate', company)}
                  className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <PlayCircle className="size-4" aria-hidden="true" /> Reactivate company
                </button>
              ) : company.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => onAction('suspend', company)}
                  className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border border-danger bg-card px-3.5 text-danger outline-none hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Ban className="size-4" aria-hidden="true" /> Suspend company
                </button>
              ) : null}
            </footer>
          </>
        )}
      </motion.aside>
    </motion.div>
  )
}

function Header({ company, onClose }) {
  return (
    <div className="flex items-start gap-3 px-6 pt-6 pb-4">
      <span
        aria-hidden="true"
        className={cn('text-badge flex size-11 shrink-0 items-center justify-center rounded-[10px]', tileTone(company))}
      >
        {companyInitials(company.name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-page-title min-w-0 break-words">{company.name}</h2>
          <StatusPill status={company.status} />
          {company.is_new && <Pill>New</Pill>}
        </div>
        <p className="text-caption">
          {companySubtitle(company)} · Company ID {company.id}
        </p>
      </div>
      <CloseButton onClick={onClose} />
    </div>
  )
}

function Overview({ company, onSeeDepartments }) {
  const largest = company.largest_departments ?? []
  return (
    <>
      {company.status === 'suspended' && (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-warning-soft px-4 py-3">
          <p className="text-badge text-warning">{suspendedText(company.suspension)}</p>
          <p className="text-caption">
            {company.suspension.reason && <>“{company.suspension.reason}” · </>}
            {plural(company.users_count, 'user', 'users')} can’t sign in · data kept
          </p>
        </div>
      )}

      <dl className="flex flex-col gap-3 rounded-[10px] bg-muted px-4 py-3.5">
        <Fact label="Admin in charge">
          {company.admin ? (
            <>
              {company.admin.full_name}
              {!company.admin.is_active && <span className="text-caption"> (deactivated)</span>}
            </>
          ) : (
            <span className="text-warning">No Admin yet</span>
          )}
        </Fact>
        <Fact label="Address">{company.address || <span className="text-muted-foreground">Not set</span>}</Fact>
        {company.contact_email && <Fact label="Contact email">{company.contact_email}</Fact>}
        {company.contact_phone && <Fact label="Contact phone">{company.contact_phone}</Fact>}
        <Fact label="Users with two-step on">
          {company.users_count === 0
            ? 'No users yet'
            : `${formatNumber(company.two_factor_on)} of ${formatNumber(company.users_count)}`}
        </Fact>
        <Fact label="On the platform since">{company.created_at ? formatDate(company.created_at, 'MMM d, yyyy') : '—'}</Fact>
        <Fact label="Last activity">{company.last_activity_at ? formatTimeAgo(company.last_activity_at) : 'None yet'}</Fact>
      </dl>

      <section className="flex flex-col gap-1">
        <h3 className="text-table-head mb-1 text-muted-foreground">Largest departments</h3>
        {largest.length === 0 ? (
          <p className="text-caption">No departments yet. The company’s Admin adds them.</p>
        ) : (
          <>
            <ul>
              {largest.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 border-b py-2.5">
                  <span className="text-body truncate">{d.name}</span>
                  <span className="text-caption shrink-0">{plural(d.users_count, 'user', 'users')}</span>
                </li>
              ))}
            </ul>
            {company.departments_count > largest.length && (
              <button
                type="button"
                onClick={onSeeDepartments}
                className="text-auth-link mt-2 self-start rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                See all {company.departments_count} departments →
              </button>
            )}
          </>
        )}
      </section>
    </>
  )
}

/** "label on the left, value on the right" (the Muted box in the frame). */
function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-caption shrink-0">{label}</dt>
      <dd className="text-body-strong min-w-0 text-right break-words">{children}</dd>
    </div>
  )
}

// ------------------------------------------------------------------ Departments tab

function DepartmentsTab({ companyId }) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null })

  // the tab mounts fresh each time it's opened, so it already starts at 'loading'
  const fetchAll = useCallback(
    () =>
      listCompanyDepartments(companyId)
        .then((items) => setState({ status: 'success', items, error: null }))
        .catch((error) => setState({ status: 'error', items: [], error })),
    [companyId],
  )

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const load = () => {
    setState({ status: 'loading', items: [], error: null })
    fetchAll()
  }

  if (state.status === 'loading') return <TabLoading text="Loading departments…" />
  if (state.status === 'error')
    return (
      <ErrorState
        title="Couldn't load the departments"
        message={state.error.message}
        requestId={state.error.requestId}
        onRetry={load}
      />
    )
  if (state.items.length === 0)
    return <EmptyState icon={Building2} title="No departments yet" description="The company’s Admin adds departments." />

  return (
    <ul className="flex flex-col">
      {state.items.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0">
          <div className="min-w-0">
            <p className="text-body-strong flex items-center gap-1.5 truncate">
              {d.name}
              {!d.is_active && <Pill tone="neutral">Inactive</Pill>}
            </p>
            <p className="text-caption truncate">
              {d.code}
              {d.head && ` · Head: ${d.head}`}
            </p>
          </div>
          <span className="text-caption shrink-0">{plural(d.users_count, 'user', 'users')}</span>
        </li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------ Users / History (paged)

/** Page 1 on open, then "Load more" adds the next page underneath. */
function usePagedList(fetchPage) {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null, more: false })

  const fetchInto = useCallback(
    (page) =>
      fetchPage(page)
        .then(({ items, meta }) =>
          setState((prev) => ({
            status: 'success',
            items: page === 1 ? items : [...prev.items, ...items],
            meta,
            error: null,
            more: false,
          })),
        )
        .catch((error) =>
          // a failed "Load more" keeps what's shown and offers to try again
          setState((prev) => (page === 1 ? { status: 'error', items: [], meta: null, error, more: false } : { ...prev, error, more: false })),
        ),
    [fetchPage],
  )

  // the tab mounts fresh each time it's opened, so it already starts at 'loading'
  useEffect(() => {
    fetchInto(1)
  }, [fetchInto])

  const reload = () => {
    setState({ status: 'loading', items: [], meta: null, error: null, more: false })
    fetchInto(1)
  }
  const loadMore = () => {
    setState((prev) => ({ ...prev, more: true, error: null }))
    fetchInto(state.meta.current_page + 1)
  }

  const hasMore = Boolean(state.meta && state.meta.current_page < state.meta.last_page)
  return { ...state, hasMore, reload, loadMore }
}

function UsersTab({ companyId }) {
  const fetchPage = useCallback((page) => listCompanyUsers(companyId, page), [companyId])
  const list = usePagedList(fetchPage)

  if (list.status === 'loading') return <TabLoading text="Loading users…" />
  if (list.status === 'error')
    return <ErrorState title="Couldn't load the users" message={list.error.message} requestId={list.error.requestId} onRetry={list.reload} />
  if (list.items.length === 0)
    return <EmptyState icon={Users} title="No users yet" description="The company’s Admin creates its users." />

  return (
    <>
      <ul className="flex flex-col">
        {list.items.map((u) => (
          <li key={u.id} className="flex items-start justify-between gap-3 border-b py-2.5 last:border-b-0">
            <div className="min-w-0">
              <p className="text-body-strong truncate">{u.full_name}</p>
              <p className="text-caption truncate">
                {ROLE_LABELS[u.role] ?? u.role}
                {u.department && ` · ${u.department}`}
              </p>
              <p className="text-caption truncate">{u.email}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <UserStatusPill status={u.status} />
              {u.membership === 'access' && <Pill tone="neutral">Access only</Pill>}
            </div>
          </li>
        ))}
      </ul>
      <LoadMore list={list} shown={list.items.length} noun={['user', 'users']} />
    </>
  )
}

function UserStatusPill({ status }) {
  if (status === 'inactive') return <Pill tone="neutral">Inactive</Pill>
  if (status === 'pending') return <Pill tone="warning">Pending</Pill>
  return <Pill tone="success">Active</Pill>
}

/** What each history row says. Anything new and unknown still shows, with its raw action name. */
const HISTORY = {
  company_created: { icon: Building2, tone: 'bg-primary-soft text-primary', text: 'Added to the platform', detail: () => null },
  company_suspended: { icon: Ban, tone: 'bg-warning-soft text-warning', text: 'Suspended', detail: (e) => e.new?.reason && `“${e.new.reason}”` },
  company_reactivated: { icon: RotateCcw, tone: 'bg-success-soft text-success', text: 'Reactivated', detail: (e) => e.new?.note && `Note: “${e.new.note}”` },
}

function HistoryTab({ companyId }) {
  const fetchPage = useCallback((page) => listCompanyHistory(companyId, page), [companyId])
  const list = usePagedList(fetchPage)

  if (list.status === 'loading') return <TabLoading text="Loading history…" />
  if (list.status === 'error')
    return <ErrorState title="Couldn't load the history" message={list.error.message} requestId={list.error.requestId} onRetry={list.reload} />

  const createdAt = list.meta?.created_at
  const atTheEnd = !list.hasMore
  // Companies added from "+ Add company" have their own "Added … by" row; older ones only have created_at
  const hasCreatedRow = list.items.some((e) => e.action === 'company_created')
  const changes = list.items.filter((e) => e.action !== 'company_created').length

  return (
    <>
      <ol className="flex flex-col">
        {list.items.map((e) => {
          const kind = HISTORY[e.action] ?? { icon: Building2, tone: 'bg-muted text-muted-foreground', text: e.action.replaceAll('_', ' '), detail: () => null }
          const detail = kind.detail(e)
          return (
            <li key={e.id} className="flex gap-3 border-b py-3 last:border-b-0">
              <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', kind.tone)}>
                <kind.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body">
                  <span className="text-body-strong">{kind.text}</span> by {e.by?.full_name ?? 'the system'}
                </p>
                {detail && <p className="text-caption break-words">{detail}</p>}
                {e.action === 'company_suspended' && e.new?.users_signed_out > 0 && (
                  <p className="text-caption">{plural(e.new.users_signed_out, 'person was', 'people were')} signed out</p>
                )}
              </div>
              <time className="text-caption shrink-0" dateTime={e.at}>
                {formatTimeAgo(e.at)}
              </time>
            </li>
          )
        })}
        {atTheEnd && createdAt && !hasCreatedRow && (
          <li className="flex gap-3 py-3">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Building2 className="size-4" />
            </span>
            <p className="text-body flex-1">
              <span className="text-body-strong">Added to the platform</span>
            </p>
            <time className="text-caption shrink-0" dateTime={createdAt}>
              {formatDate(createdAt, 'MMM d, yyyy')}
            </time>
          </li>
        )}
      </ol>
      {changes === 0 && (
        <p className="text-caption">Never suspended. Suspensions and reactivations will show up here.</p>
      )}
      <LoadMore list={list} shown={list.items.length} noun={['change', 'changes']} />
    </>
  )
}

function LoadMore({ list, shown, noun }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {list.error && <p role="alert" className="text-caption text-danger">Couldn’t load more: {list.error.message}</p>}
      {list.hasMore && (
        <button
          type="button"
          disabled={list.more}
          onClick={list.loadMore}
          className="text-auth-link flex items-center gap-1.5 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {list.more && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {list.error ? 'Try again' : 'Load more'}
        </button>
      )}
      {list.meta?.total > 0 && (
        <p className="text-caption">
          Showing {shown} of {plural(list.meta.total, noun[0], noun[1])}
        </p>
      )}
    </div>
  )
}

function TabLoading({ text }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10">
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
      <span className="text-caption">{text}</span>
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
