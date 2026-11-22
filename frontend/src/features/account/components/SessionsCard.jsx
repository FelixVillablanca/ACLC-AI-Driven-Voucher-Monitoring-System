import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Loader2, LogOut, MonitorSmartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import Pill from '@/components/common/Pill'
import { formatTimeAgo, plural } from '@/lib/formatters'
import { listSessions, signOutOtherSessions, signOutSession } from '../api'
import { buttonClass, deviceIcon } from '../utils'
import { AccountCard } from './AccountPageShell'

/**
 * Account settings → Where you're signed in. One row per browser (this one first, with a
 * "This browser" pill). Sign out one, or every other one at once (with a confirm).
 * The server only sends a fingerprint of each session, never the real session ID.
 */
export default function SessionsCard({ onCountChanged }) {
  const [state, setState] = useState({ status: 'loading', list: null, error: null })
  const [busyKey, setBusyKey] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState(null)
  const [signingOutAll, setSigningOutAll] = useState(false)

  const load = useCallback(
    () =>
      listSessions()
        .then((list) => {
          setState({ status: 'success', list, error: null })
          onCountChanged?.(list.length)
        })
        .catch((error) => setState({ status: 'error', list: null, error })),
    [onCountChanged],
  )
  useEffect(() => {
    load()
  }, [load])

  const signOutOne = async (session) => {
    setBusyKey(session.key)
    try {
      await signOutSession(session.key)
      toast.success(`Signed out ${session.device ?? 'that device'}.`)
    } catch (error) {
      // already gone (404) is fine: the list refreshes either way
      if (error.status !== 404) toast.error(error.message)
    } finally {
      setBusyKey(null)
      load()
    }
  }

  const signOutAll = async () => {
    setSigningOutAll(true)
    setConfirmError(null)
    try {
      const count = await signOutOtherSessions()
      toast.success(count ? `Signed out ${plural(count, 'other device', 'other devices')}.` : 'No other devices were signed in.')
      setConfirming(false)
      load()
    } catch (error) {
      setConfirmError(error)
    } finally {
      setSigningOutAll(false)
    }
  }

  const others = state.list?.filter((s) => !s.current) ?? []

  return (
    <AccountCard
      title="Where you’re signed in"
      description="Browsers that are signed in to your account right now."
      icon={MonitorSmartphone}
      actions={
        others.length > 0 && (
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass.secondary}>
            <LogOut className="size-4" aria-hidden="true" /> Sign out all other devices
          </button>
        )
      }
    >
      {state.status === 'loading' && (
        <p role="status" className="text-caption flex items-center gap-2 py-4">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Loading your devices…
        </p>
      )}
      {state.status === 'error' && (
        <ErrorState
          title="Couldn't load your devices"
          message={state.error.message}
          requestId={state.error.requestId}
          onRetry={load}
          className="p-4"
        />
      )}
      {state.status === 'success' && (
        <>
          <ul className="flex flex-col">
            {state.list.length === 0 && <li className="text-caption py-2">Only this browser.</li>}
            {state.list.map((session) => {
              const Icon = deviceIcon(session.device)
              return (
                <li key={session.key} className="flex items-center gap-3 border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-strong flex flex-wrap items-center gap-2">
                      {session.device ?? 'Unknown browser'}
                      {session.current && <Pill tone="success">This browser</Pill>}
                    </p>
                    <p className="text-caption">
                      {[
                        session.ip ?? 'IP unknown',
                        session.current ? 'active now' : `last active ${formatTimeAgo(session.last_active_at)}`,
                      ].join(' · ')}
                    </p>
                  </div>
                  {!session.current && (
                    <button type="button" onClick={() => signOutOne(session)} disabled={busyKey !== null} className={buttonClass.secondary}>
                      {busyKey === session.key && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                      Sign out
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-caption">Don’t recognise a device? Sign it out, then change your password.</p>
        </>
      )}

      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            title={`Sign out ${plural(others.length, 'other device', 'other devices')}?`}
            icon={{ icon: LogOut, tone: 'primary' }}
            confirmLabel="Sign them out"
            busy={signingOutAll}
            error={confirmError}
            onConfirm={signOutAll}
            onCancel={() => setConfirming(false)}
          >
            <p>
              Every browser except this one is signed out right away, including ones that used “Keep me signed in”. You stay signed in here.
            </p>
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </AccountCard>
  )
}
