import { Link } from 'react-router-dom'
import { Briefcase, ChevronRight, KeyRound, Lock, MonitorSmartphone, ShieldAlert, ShieldCheck } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import Pill from '@/components/common/Pill'
import { ROLE_LABELS } from '@/lib/constants'
import { formatDate, formatDayAgo, formatInitials, formatSignInTime, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import AccountPageShell, { AccountCard, DetailRow } from '../components/AccountPageShell'
import PersonalDetailsCard from '../components/PersonalDetailsCard'
import { useAccount } from '../hooks/useAccount'
import { accountLinks } from '../utils'

/**
 * My profile (no Framer frame, code-first): who you are in the system.
 *   - identity card (initials, name, role, sign-in email, company)
 *   - Personal details: name + personal email, editable
 *   - Work details: read-only (someone above you decides them)
 *   - Security at a glance, each line linking to where you fix it
 */
export default function MyProfilePage() {
  const account = useAccount()

  return (
    <AccountPageShell title="My profile" description="Your details in the AI-Driven Voucher Monitoring System.">
      {account.status === 'loading' && (
        <div className="rounded-xl border bg-card">
          <LoadingState label="Loading your profile…" />
        </div>
      )}
      {account.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load your profile"
            message={account.error.message}
            requestId={account.error.requestId}
            onRetry={account.reload}
          />
        </div>
      )}
      {account.status === 'success' && <Profile account={account.data} onSaved={account.replace} onStale={account.reload} />}
    </AccountPageShell>
  )
}

function Profile({ account, onSaved, onStale }) {
  const links = accountLinks(account.role)

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-5 py-6 text-center">
          <div
            aria-hidden="true"
            className="flex size-[72px] items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground"
          >
            {formatInitials(account)}
          </div>
          <div className="min-w-0">
            <p className="text-card-title text-base">{account.full_name}</p>
            <p className="text-caption break-all">{account.email}</p>
          </div>
          <Pill tone={account.role === 'super_admin' ? 'warning' : 'primary'}>{ROLE_LABELS[account.role] ?? account.role}</Pill>
          <dl className="mt-1 flex w-full flex-col gap-2 border-t pt-4 text-left">
            <Fact label="Employee ID">{account.employee_id ?? '—'}</Fact>
            <Fact label="Company">{account.company?.name ?? (account.role === 'super_admin' ? 'All companies' : '—')}</Fact>
            <Fact label="Member since">{account.member_since ? formatDate(account.member_since, 'MMM d, yyyy') : '—'}</Fact>
          </dl>
        </section>

        <SecurityGlance account={account} links={links} />
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <PersonalDetailsCard account={account} onSaved={onSaved} onStale={onStale} />

        <AccountCard
          title="Work details"
          description={
            account.role === 'super_admin'
              ? 'Set when your Super Admin account was made.'
              : 'Set by your Super Admin. Ask them if something here is wrong.'
          }
          icon={Briefcase}
        >
          <dl>
            <DetailRow label="Sign-in email" hint="Follows your role, so it can’t be changed here.">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                {account.email}
              </span>
            </DetailRow>
            <DetailRow label="Role">{ROLE_LABELS[account.role] ?? account.role}</DetailRow>
            <DetailRow label="Company">
              {account.company?.name ?? (account.role === 'super_admin' ? 'The whole platform (no single company)' : '—')}
            </DetailRow>
            {account.role !== 'super_admin' && <DetailRow label="Department">{account.department?.name ?? 'None'}</DetailRow>}
            <DetailRow label="Employee ID">{account.employee_id ?? '—'}</DetailRow>
            <DetailRow label="Account made by">{account.created_by ?? 'The server console (setup)'}</DetailRow>
          </dl>
        </AccountCard>
      </div>
    </div>
  )
}

function Fact({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption">{label}</dt>
      <dd className="text-body-strong min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}

/** Four short lines; each one opens the page where you can act on it. */
function SecurityGlance({ account, links }) {
  const tf = account.two_factor
  const twoStep =
    tf.status === 'on'
      ? { text: 'Two-step sign-in is on', tone: 'success', icon: ShieldCheck }
      : tf.status === 'required'
        ? { text: 'Two-step sign-in must be set up', tone: 'warning', icon: ShieldAlert }
        : { text: 'Two-step sign-in is off', tone: 'warning', icon: ShieldAlert }

  const rows = [
    {
      to: links.changePassword,
      icon: KeyRound,
      text: account.password_changed_at ? `Password changed ${formatDayAgo(account.password_changed_at)}` : 'Password never changed here',
      tone: 'neutral',
    },
    { to: links.settings, icon: twoStep.icon, text: twoStep.text, tone: twoStep.tone },
    {
      to: links.settings,
      icon: MonitorSmartphone,
      text: `Signed in on ${plural(account.sessions_count || 1, 'device', 'devices')}`,
      tone: 'neutral',
    },
    {
      to: links.activity,
      icon: ShieldAlert,
      text: account.failed_sign_ins_30d
        ? `${plural(account.failed_sign_ins_30d, 'failed sign-in', 'failed sign-ins')} in 30 days`
        : 'No failed sign-ins in 30 days',
      tone: account.failed_sign_ins_30d ? 'danger' : 'success',
    },
  ]

  return (
    <AccountCard title="Security at a glance" description={lastSignInText(account)}>
      <ul className="-mx-2 flex flex-col">
        {rows.map((row) => (
          <li key={row.text}>
            <Link
              to={row.to}
              className="text-body flex items-center gap-2.5 rounded-lg px-2 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <row.icon
                className={cn(
                  'size-4 shrink-0',
                  { success: 'text-success', warning: 'text-warning', danger: 'text-danger', neutral: 'text-muted-foreground' }[row.tone],
                )}
                aria-hidden="true"
              />
              <span className="flex-1">{row.text}</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </AccountCard>
  )
}

function lastSignInText(account) {
  const prev = account.previous_sign_in
  if (!prev) return 'This is your first recorded sign-in.'
  const where = [prev.device, prev.ip].filter(Boolean).join(' · ')
  return `Before this visit: ${formatSignInTime(prev.at)}${where ? ` (${where})` : ''}.`
}
