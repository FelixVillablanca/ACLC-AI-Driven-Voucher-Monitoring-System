import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Building2, Check, Home, Loader2, Mail, Search, SearchX, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import ModalShell from '@/components/common/ModalShell'
import Pill from '@/components/common/Pill'
import { refreshUser } from '@/features/auth'
import { useSwitchCompany } from '@/hooks/useSwitchCompany'
import { formatTimeAgo } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { answerInvitation, cancelJoinRequest, requestToJoin } from '../api'
import { useMyCompanyAccess } from '../hooks/useMyCompanyAccess'
import { MANAGE_COMPANIES_SEARCH, TYPE_LABELS } from '../utils'

const PARAM = MANAGE_COMPANIES_SEARCH.slice(1).split('=')

/**
 * "Join another company" (?companies=manage, 2026-11-22) for clerks, officers and supervisors:
 *   Invitations   an Admin of another company invited you → Accept / Decline
 *   Your requests companies you asked to join → Withdraw
 *   Your companies where you work now (your own company is marked)
 *   Ask to join   search companies and send a request (their Admin answers)
 * After accepting, your sign-in is reloaded so the new company appears in the switcher.
 */
export default function JoinCompanyModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get(PARAM[0]) === PARAM[1]
  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete(PARAM[0])
          return p
        },
        { replace: true },
      ),
    [setParams],
  )
  return <AnimatePresence>{open && <Window onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const [text, setText] = useState('')
  const mine = useMyCompanyAccess(text)
  const switchTo = useSwitchCompany() // switches and goes to the dashboard (this window closes)
  const [busy, setBusy] = useState(null) // `${action}-${companyId}`
  const [asking, setAsking] = useState(null) // company with the message box open
  const [message, setMessage] = useState('')

  const act = async (id, work, done, after) => {
    setBusy(id)
    try {
      await work()
      toast.success(done)
      mine.reload()
      await after?.()
    } catch (error) {
      toast.error(error.message)
      if (error.status === 404 || error.status === 409) mine.reload()
    } finally {
      setBusy(null)
    }
  }

  const accept = (c) =>
    act(
      `accept-${c.id}`,
      () => answerInvitation(c.id, true),
      `You can now work in ${c.name}.`,
      async () => {
        await refreshUser() // the switcher learns about the new company
        toast(
          (t) => (
            <span className="flex items-center gap-2">
              Switch to {c.name} now?
              <button
                type="button"
                className="font-semibold text-primary"
                onClick={() => {
                  switchTo(c.id)
                  toast.dismiss(t.id)
                }}
              >
                Switch
              </button>
            </span>
          ),
          { duration: 8000 },
        )
      },
    )

  const send = (c) =>
    act(
      `ask-${c.id}`,
      () => requestToJoin(c.id, message.trim()),
      `Request sent to ${c.name}. Its Admin will answer.`,
      () => {
        setAsking(null)
        setMessage('')
      },
    )

  const d = mine.data

  return (
    <ModalShell
      title="Join another company"
      subtitle="Work in more than one company: answer invitations, or ask a company to let you join."
      width={640}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        {mine.status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 p-12">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading your companies…</span>
          </div>
        )}

        {mine.status === 'error' && !d && (
          <ErrorState
            title="Couldn't load your companies"
            message={mine.error.message}
            requestId={mine.error.requestId}
            onRetry={mine.reload}
          />
        )}

        {d && (
          <>
            {d.invitations.length > 0 && (
              <Section title="Invitations" count={d.invitations.length}>
                {d.invitations.map((c) => (
                  <Row
                    key={c.id}
                    company={c}
                    note={`Invited by ${c.asked_by ?? 'an Admin'}${c.at ? ` · ${formatTimeAgo(c.at)}` : ''}`}
                    message={c.message}
                    highlight
                  >
                    <SmallButton
                      onClick={() => act(`decline-${c.id}`, () => answerInvitation(c.id, false), `You declined ${c.name}'s invitation.`)}
                      busy={busy === `decline-${c.id}`}
                    >
                      Decline
                    </SmallButton>
                    <SmallButton
                      primary
                      onClick={() => accept(c)}
                      busy={busy === `accept-${c.id}`}
                      disabled={c.suspended}
                      title={c.suspended ? 'This company is suspended right now' : undefined}
                    >
                      <Check className="size-4" aria-hidden="true" /> Accept
                    </SmallButton>
                  </Row>
                ))}
              </Section>
            )}

            {d.requests.length > 0 && (
              <Section title="Your requests" count={d.requests.length}>
                {d.requests.map((c) => (
                  <Row
                    key={c.id}
                    company={c}
                    note={`Waiting for its Admin${c.at ? ` · asked ${formatTimeAgo(c.at)}` : ''}`}
                    message={c.message}
                  >
                    <SmallButton
                      onClick={() => act(`cancel-${c.id}`, () => cancelJoinRequest(c.id), `Request to ${c.name} withdrawn.`)}
                      busy={busy === `cancel-${c.id}`}
                    >
                      Withdraw
                    </SmallButton>
                  </Row>
                ))}
              </Section>
            )}

            <Section title="Your companies" count={d.companies.length}>
              {d.companies.length === 0 ? (
                <p className="text-caption px-4 py-3">You don't work in any company yet. Ask your Admin, or ask to join one below.</p>
              ) : (
                d.companies.map((c) => (
                  <Row key={c.id} company={c} note={c.is_home ? 'Your own company' : 'Joined'}>
                    {c.is_home && (
                      <Pill tone="primary">
                        <Home className="mr-1 size-3" aria-hidden="true" /> Home
                      </Pill>
                    )}
                    {c.suspended && <Pill tone="warning">Suspended</Pill>}
                  </Row>
                ))
              )}
            </Section>

            <Section title="Ask to join a company">
              <div className="px-4 pt-3">
                <label className="flex h-[38px] items-center gap-2.5 rounded-lg border bg-muted px-3 focus-within:border-primary focus-within:bg-card">
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">Search companies</span>
                  <input
                    type="search"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={100}
                    placeholder="Search companies by name"
                    className="text-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                  />
                  {text && (
                    <button
                      type="button"
                      onClick={() => setText('')}
                      aria-label="Clear search"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </label>
              </div>
              {d.can_ask.length === 0 ? (
                <EmptyState
                  icon={text ? SearchX : Building2}
                  title={text ? `No company matches “${text.trim()}”` : 'No other companies to ask'}
                  description={text ? 'Try another name.' : 'You already work in, or have asked, every active company.'}
                  className="p-6"
                />
              ) : (
                <ul className="mt-2">
                  {d.can_ask.map((c) => {
                    const open = asking?.id === c.id
                    return (
                      <li key={c.id} className={cn('border-b last:border-b-0', open && 'bg-primary-faint')}>
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <CompanyTile name={c.name} />
                          <span className="min-w-0 flex-1">
                            <span className="text-body-strong block truncate">{c.name}</span>
                            <span className="text-caption">{TYPE_LABELS[c.type] ?? c.type}</span>
                          </span>
                          {!open && (
                            <SmallButton
                              onClick={() => {
                                setAsking(c)
                                setMessage('')
                              }}
                            >
                              <Send className="size-3.5" aria-hidden="true" /> Ask to join
                            </SmallButton>
                          )}
                        </div>
                        {open && (
                          <div className="flex flex-col gap-2 px-4 pb-3">
                            <label htmlFor="join-message" className="text-label">
                              Message to their Admin (optional)
                            </label>
                            <textarea
                              id="join-message"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              maxLength={500}
                              rows={2}
                              placeholder="e.g. I'll handle your payables two days a week."
                              className="text-body resize-none rounded-lg border bg-card px-3 py-2 outline-none focus:border-primary"
                            />
                            <div className="flex justify-end gap-2">
                              <SmallButton onClick={() => setAsking(null)}>Cancel</SmallButton>
                              <SmallButton primary onClick={() => send(c)} busy={busy === `ask-${c.id}`}>
                                Send request
                              </SmallButton>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-muted px-6 py-3.5">
        <p className="text-caption flex items-center gap-1.5">
          <Mail className="size-3.5" aria-hidden="true" /> Answers arrive in your notifications.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-body-strong h-[38px] rounded-lg border bg-card px-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Done
        </button>
      </div>
    </ModalShell>
  )
}

function Section({ title, count, children }) {
  return (
    <section className="overflow-hidden rounded-xl border">
      <h3 className="text-table-head border-b bg-muted px-4 py-2 text-muted-foreground">
        {title}
        {count !== undefined && ` · ${count}`}
      </h3>
      <div>{children}</div>
    </section>
  )
}

function Row({ company, note, message, highlight, children }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0', highlight && 'bg-primary-faint')}>
      <CompanyTile name={company.name} />
      <div className="min-w-0 flex-1">
        <p className="text-body-strong truncate">{company.name}</p>
        <p className="text-caption">{note}</p>
        {message && <p className="text-body mt-1.5 rounded-lg bg-card px-3 py-2">“{message}”</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function CompanyTile({ name = '' }) {
  const letters = (name.match(/\b\p{L}/gu) ?? ['?']).slice(0, 2).join('').toUpperCase()
  return (
    <span className="text-badge flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{letters}</span>
  )
}

function SmallButton({ primary, busy, disabled, title, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
      className={cn(
        'flex h-[34px] items-center gap-1.5 rounded-lg px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
        primary
          ? 'text-auth-button bg-primary text-primary-foreground hover:bg-primary/90'
          : 'text-body-strong border bg-card hover:bg-muted',
      )}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
