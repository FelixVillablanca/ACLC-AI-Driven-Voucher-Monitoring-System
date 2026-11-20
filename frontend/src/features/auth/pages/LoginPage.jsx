import { useCallback, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { PATHS, ROLE_HOME } from '@/lib/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import FeaturePreviews from '../components/FeaturePreviews'
import LoginBackdrop from '../components/LoginBackdrop'
import LoginForm from '../components/LoginForm'
import TwoStepChallenge from '../components/TwoStepChallenge'
import TwoStepSetup from '../components/TwoStepSetup'
import { cancelTwoFactor } from '../api'

/**
 * LOGIN PAGE: Framer "Login UI 2" (node p0wwkrh66).
 * Dark indigo background + glow rings + 4 floating preview cards + a white 420px card.
 */
export default function LoginPage() {
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()
  const location = useLocation()
  // Password was right but two-step sign-in comes next: { stage: 'challenge' | 'setup', … }
  const [twoStep, setTwoStep] = useState(null)

  const backToPassword = useCallback(() => {
    cancelTwoFactor().catch(() => {}) // forgetting the half-finished sign-in is best-effort
    setTwoStep(null)
  }, [])

  // The 10-minute "half signed in" window ran out: say so and start again
  const expired = useCallback((error) => {
    toast.error(error.message, { id: 'two-step-expired' })
    setTwoStep(null)
  }, [])

  // Already logged in? Skip the form ("/" sends each role to its own landing page).
  if (status === 'authenticated') return <Navigate to={PATHS.HOME} replace />

  // After signing in, go to the user's OWN landing page (admin -> /admin, clerk -> /clerk, …).
  // If they were on their way to a page inside their own area, continue there instead.
  const goNext = (user) => {
    const home = ROLE_HOME[user.role] ?? PATHS.HOME
    const from = location.state?.from?.pathname
    navigate(from?.startsWith(home) ? from : home, { replace: true })
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-primary-dark">
      <LoginBackdrop>
        <FeaturePreviews />
      </LoginBackdrop>

      {/* Top bar */}
      <header className="relative flex flex-wrap items-center justify-between gap-3 px-4 pt-7 sm:px-10">
        <p className="text-brand-logo text-white">Voucher Monitoring</p>
        <p className="text-brand-small flex h-[34px] items-center rounded-full border border-on-dark-border bg-on-dark-surface px-3.5 text-on-dark-muted">
          Trouble signing in? Contact your administrator
        </p>
      </header>

      {/* Sign-in card */}
      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <section
          aria-labelledby="login-heading"
          className="flex w-full max-w-[420px] flex-col gap-6 rounded-[18px] border border-on-dark-border bg-card px-6 pt-9 pb-7 shadow-2xl shadow-black/30 sm:px-9"
        >
          {twoStep?.stage === 'challenge' && (
            <TwoStepChallenge step={twoStep} onSignedIn={goNext} onBack={backToPassword} onExpired={expired} />
          )}
          {twoStep?.stage === 'setup' && (
            <TwoStepSetup step={twoStep} onSignedIn={goNext} onBack={backToPassword} onExpired={expired} />
          )}

          {!twoStep && (
            <>
              <div className="flex flex-col gap-3.5">
                <span className="text-badge flex h-[26px] w-fit items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-primary">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Secure workspace sign-in
                </span>
                <div className="flex flex-col gap-1.5">
                  <h1 id="login-heading" className="text-auth-heading">
                    Welcome back
                  </h1>
                  <p className="text-body text-muted-foreground">
                    Sign in to review, approve, and track vouchers across your companies.
                  </p>
                </div>
              </div>

              <LoginForm onSuccess={goNext} onTwoFactor={setTwoStep} />

              <div className="flex items-start gap-2.5 rounded-[10px] border bg-muted px-3.5 py-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <Info className="size-3.5" aria-hidden="true" />
                </div>
                <p className="text-caption">
                  Accounts are created by your system administrator. Your role and company access load automatically
                  after sign-in.
                </p>
              </div>
            </>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-brand-small relative flex flex-wrap items-center justify-between gap-2 px-4 pb-5 text-on-dark-muted sm:px-10">
        <p>© {new Date().getFullYear()} AI-Driven Voucher Monitoring System</p>
        <p>Privacy · Terms · Security</p>
      </footer>
    </div>
  )
}
