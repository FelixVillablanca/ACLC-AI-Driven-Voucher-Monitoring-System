import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Building2, Loader2, Lock, Search, SearchX, Send, UsersRound, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import ModalShell from '@/components/common/ModalShell'
import { useDebounce } from '@/hooks/useDebounce'
import { ROLE_SHORT_LABELS } from '@/lib/constants'
import { formatInitials, plural } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { inviteToCompany, listInvitable } from '../api'
import { announceAccessChanged } from '../utils'

/**
 * "Invite from other companies" (?invite=people, 2026-11-22). Search clerks, officers and supervisors
 * of OTHER companies and invite them to work in yours; they accept or decline. Before they join you
 * only see their name, role, home company and department (privacy rule; department added 2026-11-28), so the search is
 * by name, company or department.
 */
export default function InvitePeopleModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get('invite') === 'people'
  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete('invite')
          return p
        },
        { replace: true },
      ),
    [setParams],
  )
  return <AnimatePresence>{open && <Window onClose={close} />}</AnimatePresence>
}

function Window({ onClose }) {
  const companyName = useAuthStore((s) => s.user?.company?.name) ?? 'your company'
  const [text, setText] = useState('')
  const search = useDebounce(text.trim(), 300)
  const [attempt, setAttempt] = useState(0)
  const [list, setList] = useState({ key: null, status: 'loading', people: [], meta: null, error: null })
  const [picked, setPicked] = useState(null) // the person being invited (message box open)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState([]) // names invited in this window
  const key = `${search}|${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    listInvitable({ search, signal: controller.signal })
      .then(({ people, meta }) => setList({ key, status: 'success', people, meta, error: null }))
      .catch((error) => !controller.signal.aborted && setList({ key, status: 'error', people: [], meta: null, error }))
    return () => controller.abort()
  }, [search, key])

  const status = list.key === key ? list.status : 'loading'

  const send = async () => {
    setSending(true)
    try {
      await inviteToCompany(picked.id, message.trim())
      toast.success(`Invitation sent to ${picked.full_name}.`)
      announceAccessChanged()
      setSent((s) => [...s, picked.full_name])
      setPicked(null)
      setMessage('')
      setAttempt((n) => n + 1) // they leave the list
    } catch (error) {
      toast.error(error.message)
      if (error.status === 409 || error.status === 404) setAttempt((n) => n + 1)
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell
      title="Invite from other companies"
      subtitle={`Ask clerks, officers or supervisors of other companies to work in ${companyName}. They accept or decline.`}
      width={620}
      onClose={onClose}
      keepOpenOnBackdrop={Boolean(picked && message)}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pt-4 pb-3">
        <label className="flex h-[38px] items-center gap-2.5 rounded-lg border bg-muted px-3 focus-within:border-primary focus-within:bg-card">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search by name or company</span>
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            maxLength={100}
            placeholder="Search by name, company or department"
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

        <p className="text-caption flex items-center gap-1.5">
          <Lock className="size-3" aria-hidden="true" /> You only see their name, role, company and department until they join {companyName}
          .
        </p>

        <div className="min-h-[240px] flex-1 overflow-y-auto rounded-xl border">
          {status === 'loading' && (
            <div role="status" className="flex items-center justify-center gap-2 p-12">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              <span className="text-caption">Loading people…</span>
            </div>
          )}
          {status === 'error' && (
            <ErrorState
              title="Couldn't load people"
              message={list.error.message}
              requestId={list.error.requestId}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          )}
          {status === 'success' && list.people.length === 0 && (
            <EmptyState
              icon={search ? SearchX : UsersRound}
              title={search ? `No one matches “${search}”` : 'No one to invite'}
              description={
                search
                  ? 'Try another name or company.'
                  : 'There are no clerks, officers or supervisors in other companies who aren’t already invited or working here.'
              }
            />
          )}
          {status === 'success' && list.people.length > 0 && (
            <ul>
              {list.people.map((p) => {
                const open = picked?.id === p.id
                return (
                  <li key={p.id} className={cn('border-b last:border-b-0', open && 'bg-primary-faint')}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-badge flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        {formatInitials(p)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-body-strong block">{p.full_name}</span>
                        <span className="text-caption flex flex-wrap items-center gap-x-1.5">
                          {ROLE_SHORT_LABELS[p.role] ?? p.role} ·
                          <Building2 className="size-3" aria-hidden="true" /> {p.home_company}
                          {p.department && <span>· {p.department}</span>}
                          {p.previously_declined && <span className="text-warning">· declined or removed before</span>}
                        </span>
                      </span>
                      {!open && (
                        <button
                          type="button"
                          onClick={() => {
                            setPicked(p)
                            setMessage('')
                          }}
                          className="text-body-strong flex h-[34px] items-center gap-1.5 rounded-lg border bg-card px-3 text-primary outline-none hover:bg-primary-faint focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <Send className="size-3.5" aria-hidden="true" /> Invite
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="flex flex-col gap-2 px-4 pb-3">
                        <label htmlFor="invite-message" className="text-label">
                          Message (optional)
                        </label>
                        <textarea
                          id="invite-message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          maxLength={500}
                          rows={2}
                          disabled={sending}
                          placeholder={`e.g. We'd like your help with ${companyName}'s payables.`}
                          className="text-body resize-none rounded-lg border bg-card px-3 py-2 outline-none focus:border-primary"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPicked(null)}
                            disabled={sending}
                            className="text-body-strong h-[34px] rounded-lg border bg-card px-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={send}
                            disabled={sending}
                            className="text-auth-button flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                          >
                            {sending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                            Send invitation
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-muted px-6 py-3.5">
        <p className="text-caption">
          {sent.length
            ? `${plural(sent.length, 'invitation', 'invitations')} sent. See them under Requests.`
            : 'They get a notification and answer from their company switcher.'}
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
