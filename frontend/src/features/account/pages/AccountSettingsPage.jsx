import { Link } from 'react-router-dom'
import { Clock, KeyRound, Mail } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import LoadingState from '@/components/common/LoadingState'
import { formatDayAgo } from '@/lib/formatters'
import AccountPageShell, { AccountCard } from '../components/AccountPageShell'
import SessionsCard from '../components/SessionsCard'
import TwoStepCard from '../components/TwoStepCard'
import { useAccount } from '../hooks/useAccount'
import { accountLinks, buttonClass } from '../utils'

/**
 * Account settings (no Framer frame, code-first): how you sign in and where you're signed in.
 *   Two-step sign-in (turn on / new backup codes / turn off) · Where you're signed in ·
 *   Sign-in rules (read-only) · Password and personal email shortcuts
 */
export default function AccountSettingsPage() {
  const account = useAccount()

  return (
    <AccountPageShell title="Account settings" description="How you sign in, and the browsers that are signed in to your account.">
      {account.status === 'loading' && (
        <div className="rounded-xl border bg-card">
          <LoadingState label="Loading your settings…" />
        </div>
      )}
      {account.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load your settings"
            message={account.error.message}
            requestId={account.error.requestId}
            onRetry={account.reload}
          />
        </div>
      )}
      {account.status === 'success' && <Settings account={account.data} onChanged={account.replace} />}
    </AccountPageShell>
  )
}

function Settings({ account, onChanged }) {
  const links = accountLinks(account.role)
  const superAdmin = account.role === 'super_admin'

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <TwoStepCard account={account} onChanged={onChanged} />
        <SessionsCard />
      </div>

      <div className="flex flex-col gap-5">
        <AccountCard title="Password" icon={KeyRound}>
          <p className="text-body text-muted-foreground">
            {account.password_changed_at
              ? `Last changed ${formatDayAgo(account.password_changed_at)}.`
              : 'Not changed since your account was set up.'}
          </p>
          <Link to={links.changePassword} className={buttonClass.secondary}>
            Change password
          </Link>
        </AccountCard>

        <AccountCard title="Personal email" icon={Mail}>
          <p className="text-body break-all">{account.personal_email || 'Not set'}</p>
          <p className="text-caption">Password-reset links are sent here. Change it on My profile.</p>
          <Link to={links.profile} className={buttonClass.secondary}>
            Edit on My profile
          </Link>
        </AccountCard>

        <AccountCard title="Sign-in rules" description="Set for your role. You can’t change these." icon={Clock}>
          <dl className="flex flex-col gap-3">
            <Rule label="Idle sign-out">
              {superAdmin ? `After ${account.idle_timeout_minutes} minutes without activity` : 'When the browser session ends'}
            </Rule>
            <Rule label="Keep me signed in">{superAdmin ? 'Not allowed for Super Admins' : 'Up to 30 days, if you tick it'}</Rule>
            <Rule label="Wrong passwords">Several in a row raise a security alert for the Super Admins</Rule>
          </dl>
        </AccountCard>
      </div>
    </div>
  )
}

function Rule({ label, children }) {
  return (
    <div>
      <dt className="text-caption">{label}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  )
}
