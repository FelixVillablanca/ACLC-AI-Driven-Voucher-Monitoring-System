import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { differenceInCalendarDays } from 'date-fns'
import { ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import Pill from '@/components/common/Pill'
import { formatDate, plural } from '@/lib/formatters'
import { buttonClass } from '../utils'
import { AccountCard } from './AccountPageShell'
import { PasswordStepDialog, TurnOnTwoStepDialog } from './TwoStepDialogs'

/**
 * Account settings → Two-step sign-in.
 *   off       explanation + Turn on
 *   required  amber: a Super Admin requires it, with the days left + Set it up now
 *   on        since when, backup codes left (amber at 2 or fewer), Make new codes, Turn off
 *             (Turn off is greyed out with the reason when something requires it)
 */
export default function TwoStepCard({ account, onChanged }) {
  const [dialog, setDialog] = useState(null) // 'on' | 'codes' | 'off'
  const tf = account.two_factor
  const on = tf.status === 'on'
  const daysLeft = tf.setup_deadline ? Math.max(0, differenceInCalendarDays(new Date(tf.setup_deadline), new Date())) : null

  return (
    <AccountCard
      title="Two-step sign-in"
      description="A 6-digit code from your phone after your password. A stolen password alone can’t get in."
      icon={ShieldCheck}
      actions={
        on ? (
          <Pill tone="success">● On</Pill>
        ) : tf.status === 'required' ? (
          <Pill tone="warning">Required</Pill>
        ) : (
          <Pill tone="neutral">Off</Pill>
        )
      }
    >
      {on ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[10px] border bg-muted px-3.5 py-3">
              <dt className="text-caption">Turned on</dt>
              <dd className="text-body-strong">{tf.confirmed_at ? formatDate(tf.confirmed_at, 'MMM d, yyyy') : '—'}</dd>
            </div>
            <div
              className={
                tf.recovery_codes_left <= 2
                  ? 'rounded-[10px] border border-warning/25 bg-warning-soft px-3.5 py-3'
                  : 'rounded-[10px] border bg-muted px-3.5 py-3'
              }
            >
              <dt className="text-caption">Backup codes left</dt>
              <dd className={tf.recovery_codes_left <= 2 ? 'text-body-strong text-warning' : 'text-body-strong'}>
                {plural(tf.recovery_codes_left, 'code', 'codes')} of 8{tf.recovery_codes_left <= 2 && ' · make new ones soon'}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDialog('codes')} className={buttonClass.secondary}>
              Make new backup codes
            </button>
            <button
              type="button"
              onClick={() => setDialog('off')}
              disabled={Boolean(tf.turn_off_blocked)}
              title={tf.turn_off_blocked ?? undefined}
              className={buttonClass.danger}
            >
              Turn off
            </button>
          </div>
          {tf.turn_off_blocked && <p className="text-caption">You can’t turn it off: {tf.turn_off_blocked}</p>}
        </>
      ) : (
        <>
          {tf.status === 'required' ? (
            <div className="rounded-[10px] border border-warning/25 bg-warning-soft px-3.5 py-3">
              <p className="text-body-strong text-warning">A Super Admin requires two-step sign-in for your account.</p>
              <p className="text-caption">
                {daysLeft === null
                  ? 'Set it up now.'
                  : daysLeft === 0
                    ? 'Today is the last day to set it up. After that, signing in waits until it’s done.'
                    : `${plural(daysLeft, 'day', 'days')} left to set it up. After that, signing in waits until it’s done.`}
              </p>
            </div>
          ) : (
            <p className="text-body text-muted-foreground">
              You need an authenticator app on your phone (Google or Microsoft Authenticator). Setup takes about 2 minutes.
            </p>
          )}
          <div>
            <button type="button" onClick={() => setDialog('on')} className={buttonClass.primary}>
              {tf.status === 'required' ? 'Set it up now' : 'Turn on two-step sign-in'}
            </button>
          </div>
        </>
      )}

      <AnimatePresence>
        {dialog === 'on' && (
          <TurnOnTwoStepDialog
            key="on"
            email={account.email}
            onEnabled={(fresh) => {
              onChanged(fresh)
              toast.success('Two-step sign-in is on.')
            }}
            onClose={() => setDialog(null)}
          />
        )}
        {(dialog === 'codes' || dialog === 'off') && (
          <PasswordStepDialog
            key={dialog}
            kind={dialog}
            email={account.email}
            // new backup codes: only the count changes (reloading would close the dialog showing them)
            onDone={(fresh) => onChanged(fresh ?? { ...account, two_factor: { ...tf, recovery_codes_left: 8 } })}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </AccountCard>
  )
}
