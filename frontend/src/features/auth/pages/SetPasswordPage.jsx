import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { ArrowRight, Check, Circle, Clock, Loader2, TriangleAlert } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import { applyFieldErrors } from '@/lib/apiError'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { acceptInvitation, checkInvitation } from '../api'
import LoginBackdrop from '../components/LoginBackdrop'
import PasswordInput from '../components/PasswordInput'
import { setPasswordSchema } from '../schemas'

/**
 * "SET YOUR PASSWORD": opened from the invitation email link
 *   /set-password?token=…&email=carlo.reyes@Administrator.com
 * No Framer frame yet: it reuses the Login UI 2 look (dark backdrop + white card).
 *
 * States: checking the link → link expired/used → the form → saving → back to sign-in.
 */
export default function SetPasswordPage() {
  const status = useAuthStore((s) => s.status)
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [link, setLink] = useState({ status: 'checking', firstName: null, error: null })

  // Only sets state when the server answers (never straight away inside an effect)
  const runCheck = useCallback(
    () =>
      checkInvitation({ email, token })
        .then((data) => setLink({ status: 'valid', firstName: data.first_name, error: null }))
        .catch((error) =>
          setLink({ status: error.status === 410 || error.status === 422 ? 'invalid' : 'error', firstName: null, error }),
        ),
    [email, token],
  )

  useEffect(() => {
    if (email && token) runCheck()
  }, [runCheck, email, token])

  // "Try again" after a network error
  const check = () => {
    setLink({ status: 'checking', firstName: null, error: null })
    runCheck()
  }

  // Someone already signed in on this browser: send them home instead
  if (status === 'authenticated') return <Navigate to={PATHS.HOME} replace />

  const missing = !email || !token

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-primary-dark">
      <LoginBackdrop />

      <header className="relative flex items-center px-4 pt-7 sm:px-10">
        <p className="text-brand-logo text-white">Voucher Monitoring</p>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <section
          aria-labelledby="set-password-heading"
          className="flex w-full max-w-[420px] flex-col gap-6 rounded-[18px] border border-on-dark-border bg-card px-6 pt-9 pb-7 shadow-2xl shadow-black/30 sm:px-9"
        >
          {!missing && link.status === 'checking' && (
            <div role="status" className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <p className="text-caption">Checking your link…</p>
            </div>
          )}

          {(missing || link.status === 'invalid') && (
            <LinkProblem message={link.error?.message ?? 'This link is incomplete. Open it again from your email.'} />
          )}

          {link.status === 'error' && (
            <ErrorState
              title="Couldn't check your link"
              message={link.error.message}
              requestId={link.error.requestId}
              onRetry={check}
              className="p-0"
            />
          )}

          {!missing && link.status === 'valid' && <SetPasswordForm email={email} token={token} firstName={link.firstName} />}
        </section>
      </main>
    </div>
  )
}

function LinkProblem({ message }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="flex size-11 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Clock className="size-5" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 id="set-password-heading" className="text-auth-heading">
          This link can’t be used
        </h1>
        <p className="text-body text-muted-foreground">{message}</p>
      </div>
      <Link to={PATHS.LOGIN} className="text-auth-link w-fit text-primary hover:underline">
        Go to sign in
      </Link>
    </div>
  )
}

const RULES = [
  { test: (v) => v.length >= 12, label: 'At least 12 characters' },
  { test: (v) => /[A-Za-z]/.test(v), label: 'Letters' },
  { test: (v) => /[0-9]/.test(v), label: 'Numbers' },
]

function SetPasswordForm({ email, token, firstName }) {
  const navigate = useNavigate()
  const [formError, setFormError] = useState(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(setPasswordSchema), defaultValues: { password: '', password_confirmation: '' } })
  const password = useWatch({ control, name: 'password' }) ?? ''

  const onSubmit = async (values) => {
    setFormError(null)
    try {
      await acceptInvitation({ email, token, ...values })
      toast.success('Your password is set. Sign in with your work email.', { duration: 6000 })
      navigate(PATHS.LOGIN, { replace: true })
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 id="set-password-heading" className="text-auth-heading">
          {firstName ? `Welcome, ${firstName}` : 'Set your password'}
        </h1>
        <p className="text-body text-muted-foreground">
          Choose a password for <span className="font-medium text-foreground">{email}</span>. You’ll use it to sign in.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-label">
            New password
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            disabled={isSubmitting}
            invalid={!!errors.password}
            aria-describedby="password-rules"
            {...register('password')}
          />
          <ul id="password-rules" className="flex flex-wrap gap-x-4 gap-y-1">
            {RULES.map((rule) => {
              const ok = rule.test(password)
              return (
                <li key={rule.label} className={cn('text-caption flex items-center gap-1', ok && 'text-success')}>
                  {ok ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}
                  {rule.label}
                </li>
              )
            })}
          </ul>
          {errors.password && <p className="text-caption text-danger">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password_confirmation" className="text-label">
            Type it again
          </label>
          <PasswordInput
            id="password_confirmation"
            autoComplete="new-password"
            disabled={isSubmitting}
            invalid={!!errors.password_confirmation}
            {...register('password_confirmation')}
          />
          {errors.password_confirmation && (
            <p className="text-caption text-danger">{errors.password_confirmation.message}</p>
          )}
        </div>

        {formError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger-soft p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="text-body-strong text-danger">{formError.message}</p>
              {formError.requestId && <p className="text-caption mt-0.5">Reference: {formError.requestId}</p>}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="text-auth-button flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {isSubmitting ? 'Saving…' : 'Set password'}
          {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
        </button>
      </form>
    </>
  )
}
