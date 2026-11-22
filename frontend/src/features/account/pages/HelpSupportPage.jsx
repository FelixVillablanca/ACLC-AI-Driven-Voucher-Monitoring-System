import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ChevronDown, ClipboardCopy, LifeBuoy, Loader2, Mail, MessageCircleQuestion } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { PATHS, ROLE_LABELS } from '@/lib/constants'
import { formatInitials } from '@/lib/formatters'
import { useAuthStore } from '@/stores/useAuthStore'
import { getSupport } from '../api'
import AccountPageShell, { AccountCard } from '../components/AccountPageShell'
import { accountLinks, buttonClass } from '../utils'

/**
 * Help & support (no Framer frame, code-first): quick answers for your role, who can help you
 * (from the server: the level above you), and "Report a problem" with a details block to copy.
 */
export default function HelpSupportPage() {
  const user = useAuthStore((s) => s.user)
  const links = accountLinks(user?.role)
  const faqs = user?.role === 'super_admin' ? superAdminFaqs(links) : adminFaqs(links)

  return (
    <AccountPageShell title="Help & support" description="Quick answers, and who to ask when you’re stuck.">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
        <AccountCard title="Quick answers" icon={MessageCircleQuestion}>
          <div className="flex flex-col">
            {faqs.map((faq) => (
              <details key={faq.q} className="group border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
                <summary className="text-body-strong flex cursor-pointer list-none items-center justify-between gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="text-body mt-2 text-muted-foreground">{faq.a}</div>
              </details>
            ))}
          </div>
        </AccountCard>

        <div className="flex flex-col gap-5">
          <Contacts role={user?.role} />
          <ReportProblem user={user} />
        </div>
      </div>
    </AccountPageShell>
  )
}

function Contacts({ role }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const load = useCallback(
    () =>
      getSupport()
        .then((data) => setState({ status: 'success', data, error: null }))
        .catch((error) => setState({ status: 'error', data: null, error })),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  return (
    <AccountCard
      title="Who can help you"
      description={
        role === 'super_admin' ? 'The other Super Admins (platform owners).' : 'The Super Admins run the platform and your account.'
      }
      icon={LifeBuoy}
    >
      {state.status === 'loading' && (
        <p role="status" className="text-caption flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading…
        </p>
      )}
      {state.status === 'error' && (
        <ErrorState
          title="Couldn't load contacts"
          message={state.error.message}
          requestId={state.error.requestId}
          onRetry={load}
          className="p-2"
        />
      )}
      {state.status === 'success' && state.data.contacts.length === 0 && (
        <EmptyState
          icon={LifeBuoy}
          title="No one else yet"
          description={
            role === 'super_admin'
              ? 'You are the only Super Admin. A second one can be added from the server console (php artisan superadmin:create).'
              : 'No active Super Admin was found. Contact the person who set up the system.'
          }
          className="p-4"
        />
      )}
      {state.status === 'success' && state.data.contacts.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {state.data.contacts.map((c) => (
            <li key={c.email} className="flex items-center gap-2.5">
              <span
                className="text-badge flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                aria-hidden="true"
              >
                {formatInitials({ first_name: c.name.split(' ')[0], last_name: c.name.split(' ').slice(-1)[0] })}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-strong truncate">{c.name}</p>
                <p className="text-caption truncate">{ROLE_LABELS[c.role] ?? c.role}</p>
              </div>
              <a
                href={`mailto:${c.email}`}
                aria-label={`Email ${c.name}`}
                title={c.email}
                className="flex size-8 items-center justify-center rounded-md border text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Mail className="size-4" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </AccountCard>
  )
}

/** What to send when something breaks: the page, the time, the browser and the last error reference. */
function ReportProblem({ user }) {
  const copy = async () => {
    const details = [
      'Problem report: AI-Driven Voucher Monitoring System',
      `Account: ${user?.email ?? 'unknown'} (${ROLE_LABELS[user?.role] ?? user?.role ?? 'unknown'})`,
      `Time: ${new Date().toString()}`,
      `Browser: ${navigator.userAgent}`,
      `Screen: ${window.innerWidth}×${window.innerHeight}`,
      '',
      'What I was doing:',
      'What I expected:',
      'What happened instead (and the "Reference" shown in the error, if any):',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(details)
      toast.success('Details copied. Paste them into your message.')
    } catch {
      toast.error('Couldn’t copy. Write down the time and what you were doing instead.')
    }
  }

  return (
    <AccountCard title="Report a problem" icon={ClipboardCopy}>
      <p className="text-body text-muted-foreground">
        When something goes wrong, error messages show a <span className="text-foreground">Reference</span> (like req_…). Send it with what
        you were doing: it lets the problem be found in the logs.
      </p>
      <button type="button" onClick={copy} className={buttonClass.secondary}>
        <ClipboardCopy className="size-4" aria-hidden="true" /> Copy problem details
      </button>
      <Link to={PATHS.STATUS} className="text-caption inline-flex items-center gap-1 text-primary hover:underline">
        <Activity className="size-3.5" aria-hidden="true" /> Is the system up? Check the status page
      </Link>
    </AccountCard>
  )
}

function adminFaqs(links) {
  return [
    {
      q: 'How do I add a user to my company?',
      a: 'Use “+ Add user” in the top bar or Quick actions on the dashboard. Type the name, choose the role, and the sign-in email and Employee ID are made for you.',
    },
    {
      q: 'Why can’t I change my sign-in email?',
      a: 'Every sign-in email follows its role (…@Administrator.com for Admins), so it can only change when the role changes. Your Super Admin does that.',
    },
    {
      q: 'I forgot my password.',
      a: 'Ask a Super Admin to send you a reset link. It goes to your personal email and works for 60 minutes. Nobody, not even the Super Admin, sees your new password.',
    },
    {
      q: 'I lost my phone with the authenticator app.',
      a: (
        <>
          Sign in with one of your backup codes instead of the 6-digit code. Then open{' '}
          <Link to={links.settings} className="text-primary hover:underline">
            Account settings
          </Link>{' '}
          and make new backup codes, or ask a Super Admin for help.
        </>
      ),
    },
    {
      q: 'My company was suspended. What happens?',
      a: 'Its users can’t sign in until a Super Admin reactivates it. You were emailed the reason. Nothing is deleted.',
    },
    {
      q: 'Can I see vouchers or money?',
      a: 'No. Admins set up the system (users, departments, categories); vouchers belong to the clerks, officers and supervisors.',
    },
  ]
}

function superAdminFaqs(links) {
  return [
    {
      q: 'How do I add another Super Admin?',
      a: 'Super Admins are made only from the server console (php artisan superadmin:create), or by promoting an Admin on the Admins tab. There can be at most 3.',
    },
    {
      q: 'Why was I signed out?',
      a: 'Super Admins are signed out after the idle time set in Global settings → Security & sessions, and “Keep me signed in” is turned off for this role.',
    },
    {
      q: 'I lost my phone with the authenticator app.',
      a: (
        <>
          Sign in with a backup code, then make new codes in{' '}
          <Link to={links.settings} className="text-primary hover:underline">
            Account settings
          </Link>
          . If you have no codes left, another Super Admin can send you a password reset.
        </>
      ),
    },
    {
      q: 'Where do I see who changed what?',
      a: 'The Audit logs tab lists every action on the platform. Your own entries are on My activity. Entries can’t be edited or deleted.',
    },
    {
      q: 'Something is down. Where do I look first?',
      a: 'The System health tab checks every service each minute and opens an incident after 3 bad checks in a row.',
    },
  ]
}
