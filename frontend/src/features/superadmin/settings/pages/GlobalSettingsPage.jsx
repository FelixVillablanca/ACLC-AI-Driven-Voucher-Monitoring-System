import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { History, Info, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import ErrorState from '@/components/common/ErrorState'
import { plural } from '@/lib/formatters'
import AiSettingsCard from '../components/AiSettingsCard'
import ApprovalRulesCard from '../components/ApprovalRulesCard'
import BackupsCard from '../components/BackupsCard'
import ChangeHistoryPanel from '../components/ChangeHistoryPanel'
import DiscardChangesDialog from '../components/DiscardChangesDialog'
import OpenAiCard from '../components/OpenAiCard'
import SaveChangesModal from '../components/SaveChangesModal'
import SectionNav from '../components/SectionNav'
import SecurityCard from '../components/SecurityCard'
import { useGlobalSettings } from '../hooks/useGlobalSettings'
import { KEYS, SECTIONS, SETTINGS, draftErrors, pendingChanges, settingLabel, showValue } from '../utils'

const MONEY_KEYS = [KEYS.THRESHOLD, KEYS.BUDGET_SIGNOFF, KEYS.OPENAI_CAP]

/** "50000.00" → "50,000.00" (what a money box shows; normalizeMoney() reads it back) */
const moneyText = (v) => (v == null ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

/**
 * The Super Admin's Global settings tab (Framer tsrXCiWWw) with
 *   G1 Change history (side panel), G2 Discard (confirm), G3 Save changes (review + password).
 *
 * HOW EDITING WORKS: `saved` = what the server has; `draft` = only the settings you touched.
 * A change = a draft value that differs from the saved one. Nothing reaches the server until you
 * confirm G3 with your password; the server then checks that nobody else saved meanwhile (409).
 * Leaving the page (or closing the tab) with unsaved edits asks first.
 */
export default function GlobalSettingsPage() {
  const settings = useGlobalSettings()
  const [draft, setDraft] = useState({})
  const [overlay, setOverlay] = useState(null) // 'history' | 'discard' | 'save'
  const [active, setActive] = useState('approval')

  const saved = settings.values
  const changes = useMemo(() => (saved ? pendingChanges(saved, draft) : []), [saved, draft])
  const errors = useMemo(() => draftErrors(draft), [draft])
  const invalid = Object.keys(errors).length > 0
  const dirty = changes.length > 0 || invalid
  const dirtyGroups = useMemo(
    () => new Set([...changes.map((c) => SETTINGS[c.key].group), ...Object.keys(errors).map((k) => SETTINGS[k].group)]),
    [changes, errors],
  )

  // ---- leaving with unsaved edits: inside the app (router) and closing / reloading the tab
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // ---- which section is on screen (highlights it in the left-hand list)
  useEffect(() => {
    if (settings.status !== 'success') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -55% 0px' },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.key)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [settings.status])

  const jumpTo = (key) => {
    setActive(key)
    document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** Everything a setting row needs. Money boxes keep the TEXT you typed. */
  const field = useCallback(
    (key) => {
      const money = MONEY_KEYS.includes(key)
      const value = key in draft ? draft[key] : money ? moneyText(saved[key]) : saved[key]
      return {
        id: `setting-${key.replaceAll('.', '-')}`,
        value,
        edited: changes.some((c) => c.key === key),
        wasText: showValue(key, saved[key]),
        error: errors[key],
        onChange: (next) =>
          setDraft((d) => {
            const copy = { ...d }
            // a switch / choice put back to its saved value is no longer an edit
            if (!money && next === saved[key]) delete copy[key]
            else copy[key] = next
            return copy
          }),
      }
    },
    [draft, saved, changes, errors],
  )

  const closeOverlay = useCallback(() => setOverlay(null), [])

  const discard = () => {
    setDraft({})
    setOverlay(null)
    toast.success('Changes discarded. The saved values are back.')
  }

  const restore = (key, value) => {
    setDraft((d) => ({ ...d, [key]: MONEY_KEYS.includes(key) ? moneyText(value) : value }))
    setOverlay(null)
    jumpTo(SETTINGS[key].group)
    toast(`${settingLabel(key)} set back to ${showValue(key, value)}. Save to apply it.`, { icon: '↺' })
  }

  const onSaved = (result) => {
    settings.replace(result.values, result.lastSaved)
    setDraft({})
    setOverlay(null)
    toast.success(
      `${plural(result.changed.length, 'setting', 'settings')} saved. ${result.changed.length === 1 ? 'It applies' : 'They apply'} now.`,
    )
    if (result.adminsNotified != null) toast.success(`${plural(result.adminsNotified, 'admin was', 'admins were')} notified.`)
    if (result.twoFactorRequired) toast.success(`Two-step is now required for ${plural(result.twoFactorRequired, 'admin', 'admins')}.`)
    if (result.twoFactorRequiredReviewers)
      toast.success(
        `Two-step is now required for ${plural(result.twoFactorRequiredReviewers, 'Accounting Officer or Supervisor', 'Accounting Officers and Supervisors')}.`,
      )
  }

  const onConflict = async () => {
    setOverlay(null)
    await settings.refresh()
    toast('Loaded the latest saved values. Check your edits, then save again.', { icon: '🛈' })
  }

  if (settings.status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 py-32">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-caption">Loading global settings…</span>
      </div>
    )
  }
  if (settings.status === 'error') {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-7">
        <div className="rounded-xl border bg-card">
          <ErrorState
            title="Couldn't load the global settings"
            message={settings.error.message}
            requestId={settings.error.requestId}
            onRetry={settings.reload}
          />
        </div>
      </div>
    )
  }

  const ctx = settings.context
  const n = changes.length

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-[640px] flex-col gap-1">
          <h1 className="text-page-title">Global settings</h1>
          <p className="text-body text-muted-foreground">
            Platform-wide rules every company follows. Changes apply immediately and are written to the audit log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {n > 0 && (
            <span className="text-badge flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-warning" role="status">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
              {plural(n, 'unsaved change', 'unsaved changes')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setOverlay('history')}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <History className="size-4" aria-hidden="true" /> Change history
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => (n > 0 ? setOverlay('discard') : setDraft({}))}
            className="text-body-strong h-[38px] rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={n === 0 || invalid}
            title={invalid ? 'Fix the highlighted value first' : n === 0 ? 'Change a setting first' : undefined}
            onClick={() => setOverlay('save')}
            className="text-auth-button h-[38px] rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save changes
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="lg:w-[232px] lg:shrink-0">
          <SectionNav active={active} dirtyGroups={dirtyGroups} onPick={jumpTo} lastSaved={ctx.last_saved} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-primary-soft bg-primary-faint px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-body">
              These rules apply to {ctx.companies === 1 ? 'the 1 company' : `all ${ctx.companies} companies`}. Admins can’t change them.
              You’ll be asked for your password before saving.
            </p>
          </div>

          <ApprovalRulesCard field={field} />
          <AiSettingsCard field={field} mlService={ctx.ml_service} />
          <div className="grid gap-4 xl:grid-cols-2">
            <OpenAiCard field={field} spent={ctx.openai_spent_this_month_usd} />
            <SecurityCard field={field} admins={ctx.admins} reviewers={ctx.reviewers} />
          </div>
          <BackupsCard backups={ctx.backups} />
        </div>
      </div>

      <AnimatePresence>
        {overlay === 'history' && <ChangeHistoryPanel key="history" onClose={closeOverlay} onRestore={restore} />}
        {overlay === 'discard' && <DiscardChangesDialog key="discard" changes={changes} onCancel={closeOverlay} onConfirm={discard} />}
        {overlay === 'save' && (
          <SaveChangesModal
            key="save"
            changes={changes}
            companies={ctx.companies}
            onCancel={closeOverlay}
            onSaved={onSaved}
            onConflict={onConflict}
          />
        )}
        {blocker.state === 'blocked' && (
          <ConfirmDialog
            key="leave"
            title="Leave without saving?"
            description={`You have ${plural(n || 1, 'unsaved change', 'unsaved changes')}. If you leave, they’re lost.`}
            tone="danger"
            confirmLabel="Leave and discard"
            onConfirm={() => blocker.proceed()}
            onCancel={() => blocker.reset()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
