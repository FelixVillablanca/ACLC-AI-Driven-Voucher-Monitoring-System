import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, Circle, KeyRound, Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { generatePassword } from '@/lib/password'
import { plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { changePassword } from '../api'
import AccountPageShell, { AccountCard } from '../components/AccountPageShell'
import PasswordField from '../components/PasswordField'
import { STRENGTH_TONES, accountLinks, buttonClass, passwordChecks, passwordStrength } from '../utils'

const EMPTY = { current: '', password: '', confirmation: '' }

/**
 * Change password (no Framer frame, code-first).
 * Current password + new one twice, a live checklist of the rules (the server checks them again),
 * a strength bar, and "Suggest one". After saving, every OTHER browser is signed out.
 */
export default function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user)
  const links = accountLinks(user?.role)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null) // { signedOut }

  const checks = passwordChecks(form.password, { current: form.current, confirmation: form.confirmation, user })
  const strength = passwordStrength(form.password)
  const allOk = form.current !== '' && checks.every((c) => c.ok)

  const set = (name) => (value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  const suggest = () => {
    const password = generatePassword()
    setForm((f) => ({ ...f, password, confirmation: password }))
    setErrors({})
    toast('A strong password was filled in. Save it in your password manager before you continue.', {
      id: 'suggested-password',
      icon: '🔑',
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.current) return setErrors({ current: 'Type your current password.' })
    if (!allOk) return setErrors({ password: 'The new password doesn’t meet every rule yet.' })

    setSaving(true)
    setErrors({})
    try {
      const result = await changePassword({
        currentPassword: form.current,
        password: form.password,
        passwordConfirmation: form.confirmation,
      })
      setDone({ signedOut: result.other_sessions_signed_out })
      setForm(EMPTY)
      toast.success('Your password was changed.')
    } catch (error) {
      if (error.errors) {
        setErrors({
          current: error.errors.current_password?.[0],
          password: error.errors.password?.[0],
        })
      } else if (error.status === 429) {
        toast.error('Too many tries. Wait a minute and try again.')
      } else {
        toast.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountPageShell title="Change password" description="Choose a new password for signing in. Your Super Admin never sees it.">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        {done ? (
          <AccountCard>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-card-title text-base">Your password was changed</p>
                <p className="text-caption mt-1 max-w-sm">
                  Use it the next time you sign in.{' '}
                  {done.signedOut
                    ? `${plural(done.signedOut, 'other device was', 'other devices were')} signed out.`
                    : 'No other devices were signed in.'}{' '}
                  You stay signed in here.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to={links.profile} className={buttonClass.primary}>
                  Back to My profile
                </Link>
                {links.activity && (
                  <Link to={links.activity} className={buttonClass.secondary}>
                    See my activity
                  </Link>
                )}
              </div>
            </div>
          </AccountCard>
        ) : (
          <AccountCard title="New password" icon={KeyRound}>
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <PasswordField
                id="current-password"
                label="Current password"
                value={form.current}
                onChange={set('current')}
                error={errors.current}
                autoComplete="current-password"
                disabled={saving}
              />
              <div className="flex flex-col gap-2">
                <PasswordField
                  id="new-password"
                  label="New password"
                  value={form.password}
                  onChange={set('password')}
                  error={errors.password}
                  autoComplete="new-password"
                  maxLength={64}
                  disabled={saving}
                />
                {form.password && (
                  <div className="flex items-center gap-2" aria-live="polite">
                    <div className="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                      {[1, 2, 3, 4].map((n) => (
                        <span
                          key={n}
                          className={cn('flex-1 rounded-full', n <= strength.score ? STRENGTH_TONES[strength.score] : 'bg-border')}
                        />
                      ))}
                    </div>
                    <span className="text-caption w-16 text-right">{strength.label}</span>
                  </div>
                )}
              </div>
              <PasswordField
                id="confirm-new-password"
                label="Type the new password again"
                value={form.confirmation}
                onChange={set('confirmation')}
                autoComplete="new-password"
                maxLength={64}
                disabled={saving}
              />

              <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Password rules">
                {checks.map((check) => (
                  <li key={check.key} className={cn('text-caption flex items-center gap-1.5', check.ok && 'text-success')}>
                    {check.ok ? (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <Circle className="size-3.5" aria-hidden="true" />
                    )}
                    <span>
                      {check.label}
                      <span className="sr-only">{check.ok ? ' (done)' : ' (not yet)'}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <button type="button" onClick={suggest} disabled={saving} className={buttonClass.secondary}>
                  <Sparkles className="size-4" aria-hidden="true" /> Suggest a strong one
                </button>
                <button type="submit" disabled={saving || !allOk} className={buttonClass.primary}>
                  {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  Change password
                </button>
              </div>
            </form>
          </AccountCard>
        )}

        <AccountCard title="What happens next">
          <ul className="text-body flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
            <li>You stay signed in on this browser.</li>
            <li>Every other browser is signed out, so a stolen session stops working.</li>
            <li>
              The change is written to {links.activity ? 'your activity' : 'the audit log'}
              {user?.role === 'admin' || user?.role === 'super_admin' ? ', and the Super Admins get a low-level security alert' : ''}.
            </li>
            <li>
              {user?.role === 'admin' || user?.role === 'super_admin'
                ? `Forgot your current password? Ask ${user?.role === 'super_admin' ? 'another Super Admin' : 'your Super Admin'} to send a reset link to your personal email.`
                : 'Forgot your current password? Ask your company’s Admin to set a new one for you (Users page → New password).'}
            </li>
          </ul>
        </AccountCard>
      </div>
    </AccountPageShell>
  )
}
