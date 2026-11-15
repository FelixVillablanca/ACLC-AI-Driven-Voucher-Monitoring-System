import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { ArrowRight, Info, Loader2, Mail, TriangleAlert } from 'lucide-react'
import { applyFieldErrors } from '@/lib/apiError'
import { useLogin } from '../hooks/useLogin'
import { loginSchema } from '../schemas'
import IconInput from './IconInput'
import PasswordInput from './PasswordInput'
import RememberMeCheckbox from './RememberMeCheckbox'

/**
 * The sign-in card's form (Framer p0wwkrh66, the white 420px card).
 *
 * Error handling, so nothing ever fails silently:
 *   - empty / badly typed fields  -> red message under the field (zod, instant)
 *   - wrong email or password     -> red message under the email field (server 422)
 *   - inactive account, too many tries, server down -> red box above the button
 */
export default function LoginForm({ onSuccess }) {
  const login = useLogin()
  const [formError, setFormError] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  })

  const onSubmit = async (values) => {
    setFormError(null)
    try {
      const user = await login(values)
      onSuccess?.(user)
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(error)
    }
  }

  const showForgotPasswordHelp = () =>
    toast('Password resets are handled by your system administrator. Please contact them to reset it.', {
      icon: <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />,
      id: 'forgot-password',
    })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full flex-col gap-4">
      {/* Work email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-label">
          Work email
        </label>
        <IconInput
          id="email"
          type="email"
          icon={Mail}
          autoComplete="username"
          placeholder="you@company.com"
          invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" className="text-caption text-danger">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-label">
            Password
          </label>
          <button
            type="button"
            onClick={showForgotPasswordHelp}
            className="text-auth-link rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          disabled={isSubmitting}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" className="text-caption text-danger">
            {errors.password.message}
          </p>
        )}
      </div>

      <RememberMeCheckbox label="Keep me signed in for 30 days" disabled={isSubmitting} {...register('remember')} />

      {/* Errors that don't belong to one field */}
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
        className="text-auth-button flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-primary-foreground transition-colors outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight className="size-4" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  )
}
