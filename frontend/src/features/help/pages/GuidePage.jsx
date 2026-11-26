import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Info, Mail, Printer, TriangleAlert } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import { PATHS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import ContactSupportModal from '../components/ContactSupportModal'
import { guideBySlug, guideLink, guideTitle, readMinutes } from '../guides'
import { useApprovalRules } from '../hooks/useApprovalRules'

const NOTE_TONES = {
  info: { box: 'border-primary-soft bg-primary-faint', icon: 'text-primary', Icon: Info },
  warning: { box: 'border-warning bg-warning-soft', icon: 'text-warning', Icon: TriangleAlert },
  success: { box: 'border-success bg-success-soft', icon: 'text-success', Icon: Info },
}

const FLOW_TONES = {
  neutral: 'border bg-muted text-foreground',
  primary: 'bg-primary-soft text-primary',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
}

/**
 * A guide article (/clerk/help/:slug; Framer HZsDzsZaH), 2026-11-26.
 * "On this page" follows the scroll; Related links; Print (the browser's print); Ask support opens the
 * Contact support window (?contact=1). Texts that depend on the approval rules read the live rules.
 * Code differs from the frame: no "Was this guide helpful? Yes / No" (nothing would store or read the
 * votes), and a "not switched on yet" note on guides about features that aren't live.
 */
export default function GuidePage() {
  const { slug } = useParams()
  const guide = guideBySlug(slug)
  const rules = useApprovalRules()
  const [params, setParams] = useSearchParams()
  const contactOpen = params.get('contact') === '1'
  const setContact = (open) => setParams(open ? { contact: '1' } : {}, { replace: true })
  const active = useActiveSection(guide)

  if (!guide) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-6 sm:px-7">
        <div className="rounded-xl border bg-card">
          <EmptyState title="Guide not found" description="It may have been renamed. All guides are listed in Help & guides." />
          <div className="flex justify-center pb-8">
            <Link to={PATHS.CLERK_HELP} className="text-auth-link text-primary hover:underline">
              ← Help &amp; guides
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const reviewingNote = guide.needsReviewing && rules && !rules.reviewing_live

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">{guide.title}</h1>
          <p className="text-body text-muted-foreground">
            <Link to={PATHS.CLERK_HELP} className="inline-flex items-center gap-1 hover:text-foreground print:hidden">
              <ArrowLeft className="size-3.5" aria-hidden="true" /> Help &amp; guides
            </Link>
            <span className="print:hidden">{'  /  '}</span>
            {guide.category} · {readMinutes(guide)} min read · Updated {guide.updated}
          </p>
        </div>
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="text-body-strong flex h-[38px] items-center gap-1.5 rounded-lg border bg-card px-3.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Printer className="size-4" aria-hidden="true" /> Print
          </button>
          <button
            type="button"
            onClick={() => setContact(true)}
            className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Mail className="size-4" aria-hidden="true" /> Ask support
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
        <nav
          aria-label="On this page"
          className="flex w-full flex-col gap-1 rounded-xl border bg-card p-3.5 lg:sticky lg:top-4 lg:w-[220px] lg:shrink-0 print:hidden"
        >
          <p className="text-table-head px-2.5 pb-1 text-muted-foreground">On this page</p>
          {guide.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              aria-current={active === s.id ? 'location' : undefined}
              className={cn(
                'rounded-[7px] px-2.5 py-[7px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                active === s.id ? 'text-badge bg-primary-soft text-primary' : 'text-body hover:bg-muted',
              )}
            >
              {s.title}
            </a>
          ))}
          {guide.related?.length > 0 && (
            <>
              <div className="my-1.5 h-px bg-border" />
              <p className="text-table-head px-2.5 pb-1 text-muted-foreground">Related</p>
              {guide.related.map((r) => (
                <Link key={r} to={guideLink(r)} className="text-auth-link px-2.5 py-1 text-primary hover:underline">
                  {guideTitle(r)}
                </Link>
              ))}
            </>
          )}
        </nav>

        <article className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-xl border bg-card px-[26px] py-6">
          {guide.notLive && <Note tone="info" text={guide.notLive} title="Not switched on yet" />}
          {reviewingNote && (
            <Note
              tone="info"
              title="Not fully live yet"
              text="Reviewers get their inbox in an upcoming update. Until then, submitted vouchers wait “With Accounting” and none come back."
            />
          )}
          {guide.sections.map((s) => (
            <section key={s.id} id={s.id} className="flex scroll-mt-4 flex-col gap-3.5">
              <h2 className="text-card-title">{s.title}</h2>
              {s.blocks.map((b, i) => (
                <Block key={i} block={typeof b === 'function' ? b(rules) : b} />
              ))}
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t pt-3.5 print:hidden">
            <p className="text-body">Still stuck?</p>
            <button type="button" onClick={() => setContact(true)} className="text-auth-link text-primary hover:underline">
              Send a message to your company’s Admin →
            </button>
          </div>
        </article>
      </div>

      <AnimatePresence>{contactOpen && <ContactSupportModal onClose={() => setContact(false)} />}</AnimatePresence>
    </div>
  )
}

function Block({ block }) {
  if (block.p) return <p className="text-body">{block.p}</p>
  if (block.note) return <Note tone={block.tone} title={block.title} text={block.note} />
  if (block.list) {
    const List = block.ordered ? 'ol' : 'ul'
    return (
      <List className={cn('text-body flex flex-col gap-2 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    )
  }
  if (block.flow) {
    return (
      <ol className="flex flex-wrap items-center gap-2" aria-label="Steps">
        {block.flow.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-caption" aria-hidden="true">
                →
              </span>
            )}
            <span className={cn('text-badge rounded-full px-3 py-1.5', FLOW_TONES[step.tone])}>{step.label}</span>
          </li>
        ))}
      </ol>
    )
  }
  return null
}

function Note({ tone = 'info', title, text }) {
  const t = NOTE_TONES[tone] ?? NOTE_TONES.info
  return (
    <div className={cn('flex items-start gap-2.5 rounded-[10px] border px-3.5 py-3', t.box)}>
      <t.Icon className={cn('mt-0.5 size-4 shrink-0', t.icon)} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {title && <p className={cn('text-badge', t.icon)}>{title}</p>}
        <p className={cn(title ? 'text-caption text-foreground' : 'text-body')}>{text}</p>
      </div>
    </div>
  )
}

/** The section nearest the top of the screen, for "On this page". */
function useActiveSection(guide) {
  const [active, setActive] = useState(guide?.sections[0]?.id ?? null)
  useEffect(() => {
    if (!guide) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -60% 0px' },
    )
    guide.sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [guide])
  return active
}
