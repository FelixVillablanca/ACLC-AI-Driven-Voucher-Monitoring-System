import { useState } from 'react'
import { KeyRound, Loader2, Smartphone } from 'lucide-react'
import { verifyTwoFactor } from '../api'
import { startSession } from '../utils'
import AuthAlert from './AuthAlert'
import IconInput from './IconInput'

/**
 * Sign-in step 2 when two-step sign-in is ON: the 6-digit code from the authenticator app,
 * or one backup code (for a lost phone). Shown inside the same white login card.
 */
export default function TwoStepChallenge({ step, onSignedIn, onBack, onExpired }) {
  const [useBackup, setUseBackup] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const clean = useBackup ? value.trim() : value.replace(/\D/g, '')
    if (!useBackup && clean.length !== 6) return setFieldError('Type the 6 digits your app shows.')
    if (useBackup && clean.length < 5) return setFieldError('Type one of your backup codes, like abcde-12345.')

    setBusy(true)
    setError(null)
    setFieldError(null)
    try {
      const user = await verifyTwoFactor(useBackup ? { recoveryCode: clean } : { code: clean })
      startSession(user)
      onSignedIn(user)
    } catch (err) {
      setBusy(false)
      if (err.code === 'TWO_FACTOR_EXPIRED') return onExpired(err)
      const field = err.errors?.code?.[0] ?? err.errors?.recovery_code?.[0]
      if (field) setFieldError(field)
      else setError(err)
      setValue('')
    }
  }

  const switchMode = () => {
    setUseBackup((v) => !v)
    setValue('')
    setFieldError(null)
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 id="login-heading" className="text-auth-heading">
          Two-step sign-in
        </h1>
        <p className="text-body text-muted-foreground">
          {useBackup ? (
            'Type one of the backup codes you saved when you set up two-step sign-in. Each code works once.'
          ) : (
            <>
              Open your authenticator app and type the 6-digit code for{' '}
              <span className="font-medium text-foreground">{step.email}</span>.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="two-step-code" className="text-label">
          {useBackup ? 'Backup code' : '6-digit code'}
        </label>
        <IconInput
          key={useBackup ? 'backup' : 'code'}
          id="two-step-code"
          icon={useBackup ? KeyRound : Smartphone}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode={useBackup ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          maxLength={useBackup ? 20 : 7}
          placeholder={useBackup ? 'abcde-12345' : '123 456'}
          autoFocus
          invalid={!!fieldError}
          aria-describedby={fieldError ? 'two-step-error' : undefined}
          disabled={busy}
          className={useBackup ? undefined : '[&_input]:tracking-[0.3em]'}
        />
        {fieldError && (
          <p id="two-step-error" className="text-caption text-danger">
            {fieldError}
          </p>
        )}
      </div>

      <AuthAlert error={error} />

      <button
        type="submit"
        disabled={busy}
        className="text-auth-button flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? 'Checking…' : 'Verify and sign in'}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="text-auth-link rounded text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          ← Back to sign in
        </button>
        <button
          type="button"
          onClick={switchMode}
          disabled={busy}
          className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {useBackup ? 'Use the app code instead' : 'Lost your phone? Use a backup code'}
        </button>
      </div>
    </form>
  )
}
