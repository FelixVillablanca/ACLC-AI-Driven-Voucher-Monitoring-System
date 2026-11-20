import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { Copy, Loader2, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import ErrorState from '@/components/common/ErrorState'
import { plural } from '@/lib/formatters'
import { confirmTwoFactorSetup, getTwoFactorSetup, skipTwoFactorSetup } from '../api'
import { startSession } from '../utils'
import AuthAlert from './AuthAlert'
import IconInput from './IconInput'
import RecoveryCodesPanel from './RecoveryCodesPanel'

/**
 * Sign-in step 2 when a Super Admin REQUIRED two-step sign-in (A11): scan the QR code, type the
 * first code, then save the backup codes. "Set up later" only while the setup window is open.
 */
export default function TwoStepSetup({ step, onSignedIn, onBack, onExpired }) {
  const [info, setInfo] = useState({
    status: 'loading',
    data: null,
    error: null,
  })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(null) // 'confirm' | 'skip'
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [done, setDone] = useState(null) // { user, recoveryCodes }

  const load = useCallback(
    () =>
      getTwoFactorSetup()
        .then((data) => setInfo({ status: 'success', data, error: null }))
        .catch((err) =>
          err.code === 'TWO_FACTOR_EXPIRED' ? onExpired(err) : setInfo({ status: 'error', data: null, error: err }),
        ),
    [onExpired],
  )

  useEffect(() => {
    load()
  }, [load])

  const confirm = async (e) => {
    e.preventDefault()
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) return setFieldError('Type the 6 digits your app shows.')
    setBusy('confirm')
    setError(null)
    setFieldError(null)
    try {
      setDone(await confirmTwoFactorSetup(clean))
    } catch (err) {
      setBusy(null)
      if (err.code === 'TWO_FACTOR_EXPIRED') return onExpired(err)
      if (err.errors?.code?.[0]) setFieldError(err.errors.code[0])
      else setError(err)
      setCode('')
    }
  }

  const later = async () => {
    setBusy('skip')
    setError(null)
    try {
      const user = await skipTwoFactorSetup()
      startSession(user)
      toast('Remember to set up two-step sign-in before the deadline.', {
        id: 'two-step-later',
      })
      onSignedIn(user)
    } catch (err) {
      setBusy(null)
      if (err.code === 'TWO_FACTOR_EXPIRED') return onExpired(err)
      setError(err)
    }
  }

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(info.data.secret.replace(/\s/g, ''))
      toast.success('Key copied')
    } catch {
      toast.error('Couldn’t copy. Type the key by hand.')
    }
  }

  if (done) {
    return (
      <RecoveryCodesPanel
        codes={done.recoveryCodes}
        email={step.email}
        onContinue={() => {
          startSession(done.user)
          toast.success('Two-step sign-in is set up')
          onSignedIn(done.user)
        }}
      />
    )
  }

  const daysLeft = step.setup_deadline
    ? Math.max(0, differenceInCalendarDays(new Date(step.setup_deadline), new Date()))
    : 0

  return (
    <form onSubmit={confirm} noValidate className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 id="login-heading" className="text-auth-heading">
          Set up two-step sign-in
        </h1>
        <p className="text-body text-muted-foreground">
          Your Super Admin requires a second step for {step.email}. It takes about 2 minutes.
        </p>
      </div>

      {info.status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 py-10">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Making your QR code…</span>
        </div>
      )}

      {info.status === 'error' && (
        <ErrorState
          title="Couldn't load the QR code"
          message={info.error.message}
          requestId={info.error.requestId}
          onRetry={load}
          className="p-4"
        />
      )}

      {info.status === 'success' && (
        <>
          <ol className="text-body flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
            <li>Install an authenticator app (Google or Microsoft Authenticator).</li>
            <li>In the app, tap “+” and scan this QR code.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>

          <div className="flex flex-col items-center gap-2 rounded-[10px] border bg-muted p-3.5">
            {/* The QR picture is made by OUR server; shown as an image so it can't run anything */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(info.data.qr_svg)}`}
              alt="QR code for your authenticator app"
              className="size-44 rounded-lg bg-white p-2"
            />
            <p className="text-caption">Can’t scan? Type this key in the app instead:</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-card px-2 py-1 font-mono text-xs tracking-wide break-all">
                {info.data.secret}
              </code>
              <button
                type="button"
                onClick={copyKey}
                aria-label="Copy key"
                className="flex size-7 items-center justify-center rounded-md border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Copy className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="two-step-setup-code" className="text-label">
              6-digit code
            </label>
            <IconInput
              id="two-step-setup-code"
              icon={Smartphone}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123 456"
              invalid={!!fieldError}
              aria-describedby={fieldError ? 'two-step-setup-error' : undefined}
              disabled={busy !== null}
              className="[&_input]:tracking-[0.3em]"
            />
            {fieldError && (
              <p id="two-step-setup-error" className="text-caption text-danger">
                {fieldError}
              </p>
            )}
          </div>

          <AuthAlert error={error} />

          <button
            type="submit"
            disabled={busy !== null}
            className="text-auth-button flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy === 'confirm' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Turn on two-step sign-in
          </button>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy !== null}
          className="text-auth-link rounded text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          ← Back to sign in
        </button>
        {step.can_skip ? (
          <button
            type="button"
            onClick={later}
            disabled={busy !== null}
            className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {busy === 'skip'
              ? 'Signing in…'
              : `Set up later (${daysLeft === 0 ? 'today is the last day' : `${plural(daysLeft, 'day', 'days')} left`})`}
          </button>
        ) : (
          <span className="text-caption text-warning">The time to set it up has run out.</span>
        )}
      </div>
    </form>
  )
}
