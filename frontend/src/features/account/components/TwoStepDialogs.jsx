import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import toast from 'react-hot-toast'
import BackupCodes from '@/components/common/BackupCodes'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import FieldShell, { inputClass } from '@/components/common/FieldShell'
import { cn } from '@/lib/utils'
import { disableTwoFactor, enableTwoFactor, getTwoFactorSetup, renewRecoveryCodes } from '../api'
import PasswordField from './PasswordField'

/**
 * Account settings → Turn on two-step sign-in.
 *   step 1: scan the QR code (made by our server) and type the first 6-digit code
 *   step 2: the 8 backup codes, shown once ("Done" waits for "I saved them")
 */
export function TurnOnTwoStepDialog({ email, onEnabled, onClose }) {
  const [info, setInfo] = useState({ status: 'loading', data: null, error: null })
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState(null)

  const load = useCallback(
    () =>
      getTwoFactorSetup()
        .then((data) => setInfo({ status: 'success', data, error: null }))
        .catch((err) => setInfo({ status: 'error', data: null, error: err })),
    [],
  )
  useEffect(() => {
    load()
  }, [load])

  const confirm = async () => {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6) return setFieldError('Type the 6 digits your app shows.')
    setBusy(true)
    setError(null)
    setFieldError(null)
    try {
      const result = await enableTwoFactor(clean)
      setCodes(result.recoveryCodes)
      onEnabled(result.account)
    } catch (err) {
      setCode('')
      if (err.errors?.code?.[0]) setFieldError(err.errors.code[0])
      else if (err.code === 'TWO_FACTOR_SETUP_EXPIRED') {
        setError(err)
        setInfo({ status: 'loading', data: null, error: null })
        load()
      } else setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (codes) return <BackupCodesDialog codes={codes} email={email} title="Two-step sign-in is on" onClose={onClose} />

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(info.data.secret.replace(/\s/g, ''))
      toast.success('Key copied')
    } catch {
      toast.error('Couldn’t copy. Type the key by hand.')
    }
  }

  return (
    <ConfirmDialog
      title="Turn on two-step sign-in"
      description="After your password, you’ll also type a 6-digit code from your phone."
      icon={{ icon: ShieldCheck, tone: 'primary' }}
      confirmLabel="Turn on"
      busy={busy}
      error={error}
      confirmDisabled={info.status !== 'success'}
      onConfirm={confirm}
      onCancel={onClose}
      width={480}
    >
      {info.status === 'loading' && (
        <p role="status" className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" /> Making your QR code…
        </p>
      )}
      {info.status === 'error' && (
        <ErrorState
          title="Couldn't make the QR code"
          message={info.error.message}
          requestId={info.error.requestId}
          onRetry={load}
          className="p-4"
        />
      )}
      {info.status === 'success' && (
        <>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>Install an authenticator app (Google or Microsoft Authenticator).</li>
            <li>In the app, tap “+” and scan this QR code.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          <div className="flex flex-col items-center gap-2 rounded-[10px] border bg-muted p-3.5">
            {/* Our server made this picture; shown as an image so it can't run anything */}
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(info.data.qr_svg)}`}
              alt="QR code for your authenticator app"
              className="size-44 rounded-lg bg-white p-2"
            />
            <p className="text-caption">Can’t scan? Type this key in the app instead:</p>
            <div className="flex items-center gap-2">
              <code className="rounded bg-card px-2 py-1 font-mono text-xs tracking-wide break-all text-foreground">
                {info.data.secret}
              </code>
              <button
                type="button"
                onClick={copyKey}
                aria-label="Copy key"
                className="flex size-7 items-center justify-center rounded-md border bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Copy className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <FieldShell id="two-step-code" label="6-digit code" required error={fieldError}>
            <input
              id="two-step-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123 456"
              disabled={busy}
              autoFocus
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'two-step-code-error' : undefined}
              className={cn(inputClass, 'tracking-[0.3em]')}
            />
          </FieldShell>
        </>
      )}
    </ConfirmDialog>
  )
}

/** The backup codes, shown ONCE. "Done" stays off until they tick "I saved them". */
export function BackupCodesDialog({ codes, email, title, onClose }) {
  const [saved, setSaved] = useState(false)

  return (
    <ConfirmDialog
      title={title}
      description="Save these backup codes somewhere safe, not on the same phone. Each one lets you sign in once if you lose your phone. You won’t see them again."
      icon={{ icon: ShieldCheck, tone: 'success' }}
      confirmLabel="Done"
      confirmDisabled={!saved}
      onConfirm={onClose}
      onCancel={() => (saved ? onClose() : toast('Tick “I saved my backup codes” first.', { id: 'save-codes' }))}
      width={480}
    >
      <BackupCodes codes={codes} email={email} />
      <label className="text-body flex cursor-pointer items-center gap-2.5 text-foreground">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={cn(
            'flex size-[18px] shrink-0 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-ring/50',
            saved ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
          )}
        >
          {saved && <Check className="size-3" strokeWidth={3} />}
        </span>
        I saved my backup codes
      </label>
    </ConfirmDialog>
  )
}

/**
 * Password, then a server call. Used by "Make new backup codes" and "Turn off two-step".
 *   kind: 'codes' | 'off'
 */
export function PasswordStepDialog({ kind, email, onDone, onClose }) {
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [codes, setCodes] = useState(null)

  if (codes) return <BackupCodesDialog codes={codes} email={email} title="Your new backup codes" onClose={onClose} />

  const off = kind === 'off'

  const submit = async () => {
    if (!password) return setFieldError('Type your password to confirm.')
    setBusy(true)
    setError(null)
    setFieldError(null)
    try {
      if (off) {
        onDone(await disableTwoFactor(password))
        toast.success('Two-step sign-in is off.')
        onClose()
      } else {
        setCodes(await renewRecoveryCodes(password))
        onDone(null)
      }
    } catch (err) {
      if (err.errors?.password?.[0]) setFieldError(err.errors.password[0])
      else setError(err)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      title={off ? 'Turn off two-step sign-in?' : 'Make new backup codes?'}
      icon={off ? { icon: ShieldOff, tone: 'danger' } : { icon: KeyRound, tone: 'primary' }}
      confirmLabel={off ? 'Turn off' : 'Make new codes'}
      tone={off ? 'danger' : 'primary'}
      busy={busy}
      error={error}
      onConfirm={submit}
      onCancel={onClose}
    >
      {off ? (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Your password alone will be enough to sign in again.</li>
          <li>Your backup codes stop working.</li>
          <li>The Super Admins get a security alert that you turned it off.</li>
        </ul>
      ) : (
        <p>Your old backup codes stop working right away. Use this if you lost them or used most of them.</p>
      )}
      <PasswordField
        id="confirm-password"
        label="Your password"
        value={password}
        onChange={setPassword}
        error={fieldError}
        autoComplete="current-password"
        disabled={busy}
        autoFocus
      />
    </ConfirmDialog>
  )
}
