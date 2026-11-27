import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronDown, Mail, Search, X } from 'lucide-react'
import Pill from '@/components/common/Pill'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import ContactSupportModal from '../components/ContactSupportModal'
import StillNeedHelp from '../components/StillNeedHelp'
import { GuideIcon } from '../components/GuideIcon'
import { APPROVAL_GUIDE, FAQS, GUIDES, guideLink, guideText } from '../guides'
import { useApprovalRules } from '../hooks/useApprovalRules'

/**
 * Help & guides (/clerk/help; Framer V0J_GkScn), 2026-11-26.
 * Search across the guides and FAQ (in the browser: the guides are part of the app), popular topics,
 * guide cards, FAQ, and "Still need help?" with the real contacts: the Admin(s) of the company you're
 * working in. Contact support opens with ?contact=1.
 * Code differs from the frame (real data only): no "3-min product tour" (there's no video), no invented
 * support email / phone extension / reply time; the AI card says "Not live yet".
 */
export default function HelpCenterPage() {
  const user = useAuthStore((s) => s.user)
  const rules = useApprovalRules()
  const [params, setParams] = useSearchParams()
  const contactOpen = params.get('contact') === '1'
  const setContact = (open) => setParams(open ? { contact: '1' } : {}, { replace: true })

  const [query, setQuery] = useState('')
  const [openFaq, setOpenFaq] = useState(0)
  const results = useMemo(() => search(query, rules), [query, rules])

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Help &amp; guides</h1>
          <p className="text-body text-muted-foreground">Learn how to create, track and fix vouchers in ADVMS</p>
        </div>
        <button
          type="button"
          onClick={() => setContact(true)}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Mail className="size-4" aria-hidden="true" /> Contact support
        </button>
      </div>

      <section className="flex flex-col gap-2.5 rounded-xl bg-primary-dark px-[22px] py-5" aria-labelledby="help-search">
        <h2 id="help-search" className="text-body-strong text-white">
          What do you need help with{user?.first_name ? `, ${user.first_name}` : ''}?
        </h2>
        <div className="relative">
          <div className="flex h-11 items-center gap-2 rounded-lg bg-card px-3.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guides — e.g. “payee”, “why flagged”, “switch company”"
              aria-label="Search guides"
              className="text-body w-full bg-transparent outline-none placeholder:text-muted-foreground"
              maxLength={80}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {query.trim().length >= 2 && (
            <div
              className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border bg-card shadow-lg"
              role="listbox"
              aria-label="Search results"
            >
              {results.length === 0 ? (
                <p className="text-caption px-4 py-3">
                  Nothing found for “{query.trim()}”.{' '}
                  <button type="button" onClick={() => setContact(true)} className="text-auth-link text-primary hover:underline">
                    Ask your Admin
                  </button>
                </p>
              ) : (
                <ul>
                  {results.map((r) => (
                    <li key={r.key} className="border-b last:border-b-0">
                      {r.to ? (
                        <Link to={r.to} className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-muted">
                          <span className="text-body-strong">{r.title}</span>
                          <span className="text-caption">Guide · {r.summary}</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenFaq(r.faq)
                            setQuery('')
                            document.getElementById(`faq-${r.faq}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }}
                          className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-muted"
                        >
                          <span className="text-body-strong">{r.title}</span>
                          <span className="text-caption">Question</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-on-dark-muted">Popular:</span>
          {[...GUIDES.filter((g) => g.popular), APPROVAL_GUIDE].map((g) => (
            <Link
              key={g.slug}
              to={guideLink(g.slug)}
              className="text-caption rounded-full border border-on-dark-border bg-on-dark-surface px-2.5 py-0.5 text-on-dark-muted hover:text-white"
            >
              {g.title}
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...GUIDES, APPROVAL_GUIDE].map((g) => (
          <Link
            key={g.slug}
            to={guideLink(g.slug)}
            className={cn(
              'flex flex-col gap-2 rounded-xl border bg-card p-4 outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <GuideIcon guide={g} />
              {g.notLive && <Pill tone="neutral">Not live yet</Pill>}
            </div>
            <span className="text-card-title">{g.title}</span>
            <span className="text-caption">{g.summary}</span>
            <span className="text-auth-link mt-auto text-primary">Read guide →</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <section className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-card-title border-b px-[18px] pt-3.5 pb-3">
            Frequently asked questions
          </h2>
          {FAQS.map((f, i) => {
            const open = openFaq === i
            return (
              <div key={f.q} id={`faq-${i}`} className={cn('border-b last:border-b-0', open && 'bg-primary-faint')}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="text-body-strong flex w-full items-center justify-between gap-3 px-[18px] py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {f.q}
                  <ChevronDown
                    className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                {open && <p className="text-caption px-[18px] pb-3">{f.a(rules)}</p>}
              </div>
            )
          })}
        </section>

        <StillNeedHelp onContact={() => setContact(true)} />
      </div>

      <AnimatePresence>{contactOpen && <ContactSupportModal onClose={() => setContact(false)} />}</AnimatePresence>
    </div>
  )
}

/** Guides whose text contains every typed word, then FAQ questions. */
function search(query, rules) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
  if (!words.length) return []
  const hit = (text) => words.every((w) => text.toLowerCase().includes(w))
  const guides = GUIDES.filter((g) => hit(guideText(g, rules))).map((g) => ({
    key: g.slug,
    title: g.title,
    summary: g.summary,
    to: guideLink(g.slug),
  }))
  const approval = hit(`${APPROVAL_GUIDE.title} ${APPROVAL_GUIDE.summary} approve approval supervisor accounting review`)
    ? [{ key: APPROVAL_GUIDE.slug, title: APPROVAL_GUIDE.title, summary: APPROVAL_GUIDE.summary, to: APPROVAL_GUIDE.to }]
    : []
  const faqs = FAQS.map((f, i) => ({ f, i }))
    .filter(({ f }) => hit(`${f.q} ${f.a(rules)}`))
    .map(({ f, i }) => ({ key: `faq-${i}`, title: f.q, faq: i }))
  return [...guides, ...approval, ...faqs].slice(0, 8)
}
