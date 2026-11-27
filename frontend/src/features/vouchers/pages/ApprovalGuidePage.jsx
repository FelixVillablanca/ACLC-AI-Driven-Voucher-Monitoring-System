import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CheckCircle2, FilePen, Flag, Info, Loader2, Send, ShieldCheck, Undo2, UserCheck, Users } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import { PATHS } from '@/lib/constants'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getApprovalRules } from '../api'

/**
 * "How vouchers get approved" (clerk ⋮ menu, 2026-11-22). The agreed flow, with the CURRENT rules read
 * from Global settings (high-value threshold, AI-flagged → step 2). The "not live yet" note follows the
 * server: reviewing switches on when the approval inbox (Phase 4) is built.
 */
export default function ApprovalGuidePage() {
  const [state, setState] = useState({ status: 'loading', rules: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    getApprovalRules()
      .then((rules) => alive && setState({ status: 'success', rules, error: null }))
      .catch((error) => alive && setState({ status: 'error', rules: null, error }))
    return () => {
      alive = false
    }
  }, [attempt])

  const rules = state.rules
  const threshold = rules ? formatMoney(rules.high_value_threshold) : null

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5 px-4 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <p className="text-nav-section text-muted-foreground">Guide</p>
        <h1 className="text-page-title">How vouchers get approved</h1>
        <p className="text-body text-muted-foreground">From your draft to an approved voucher, and who looks at it on the way.</p>
      </div>

      {state.status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border bg-card p-12">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-caption">Loading the current rules…</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the rules"
            message={state.error.message}
            requestId={state.error.requestId}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        </div>
      )}

      {rules && (
        <>
          {rules.reviewing_live && rules.supervisor_live === false && (
            <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-body">
                <span className="font-medium">Step 2 isn't live yet.</span> Accounting Officers review vouchers now. Supervisors get their
                screens in an upcoming update, so a voucher that needs step 2 waits “With Supervisor” until then.
              </p>
            </div>
          )}
          {!rules.reviewing_live && (
            <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-body">
                <span className="font-medium">Not fully live yet.</span> You can create and submit vouchers now. Reviewing isn't switched on
                yet: Accounting Officers and Supervisors get their inbox in an upcoming update, so a submitted voucher waits “With
                Accounting” until then.
              </p>
            </div>
          )}

          <ol className="flex flex-col">
            <Step n={1} icon={FilePen} title="You write a draft" tone="neutral">
              Add the payee, the category, how it's paid and the lines. Drafts are saved as you go and can be incomplete. Nobody else sees
              them.
            </Step>
            <Step n={2} icon={Send} title="You submit it" tone="primary">
              It gets its voucher number and goes to the <b>Accounting Officers</b> of the company you're working in. From now on you can't
              change it.
            </Step>
            <Step n={3} icon={UserCheck} title="Step 1: an Accounting Officer reviews it" tone="primary">
              They approve it, send it back to you with a note, or reject it.
            </Step>
            <Step n={4} icon={Users} title="Step 2: the Supervisor / Manager, when needed" tone="warning">
              <span className="flex flex-col gap-1.5">
                <span>A voucher also needs the Supervisor when:</span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0 text-warning" aria-hidden="true" /> its total is <b>{threshold}</b> or more
                </span>
                {rules.ai_flagged_needs_step2 && (
                  <span className="flex items-center gap-1.5">
                    <Flag className="size-4 shrink-0 text-warning" aria-hidden="true" /> the AI check flags it as unusual, whatever the
                    amount
                  </span>
                )}
                <span className="text-caption">
                  These rules are set by the Super Admin and can change; this page always shows the current ones.
                </span>
              </span>
            </Step>
            <Step n={5} icon={ShieldCheck} title="Approved" tone="success" last>
              When step 2 isn't needed, the Accounting Officer's approval is the final one. Either way, you'll see it as Approved in My
              vouchers.
            </Step>
          </ol>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Note icon={Undo2} title="Sent back to you?">
              It shows under <b>Returned to me</b> with the reviewer's note. Fix it and submit again. It keeps its number.
            </Note>
            <Note icon={Ban} title="Changed your mind?">
              Cancel a draft or a returned voucher. It stays in your list as Cancelled, so the history is complete.
            </Note>
            <Note icon={ShieldCheck} title="Nobody approves their own voucher">
              The person who made a voucher can never approve it. That's a built-in rule.
            </Note>
            <Note icon={Flag} title="About the automatic check">
              Right after you submit, ADVMS checks the voucher against past spending (unusual amount, possible duplicate, unusual category,
              budget, new payee). A flag only asks Accounting to look closer; it never approves or rejects. It is a set of plain rules for
              now; an AI model comes later.
            </Note>
          </div>

          <Link to={PATHS.CLERK_VOUCHER_NEW} className="text-auth-link w-fit text-primary hover:underline">
            Create a voucher →
          </Link>
        </>
      )}
    </div>
  )
}

const TONES = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
}

function Step({ n, icon: Icon, title, tone, last, children }) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', TONES[tone])}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        {!last && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
      </div>
      <div className={cn('flex-1', !last && 'pb-5')}>
        <p className="text-caption">Step {n}</p>
        <p className="text-card-title">{title}</p>
        <div className="text-body mt-1 text-muted-foreground">{children}</div>
      </div>
    </li>
  )
}

function Note({ icon: Icon, title, children }) {
  return (
    <div className="flex gap-3 rounded-xl border bg-card px-4 py-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <p className="text-body-strong">{title}</p>
        <p className="text-caption mt-0.5">{children}</p>
      </div>
    </div>
  )
}
