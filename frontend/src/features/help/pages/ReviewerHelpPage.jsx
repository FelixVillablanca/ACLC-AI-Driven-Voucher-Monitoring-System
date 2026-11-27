import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ChevronRight, ListChecks, Mail, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import ContactSupportModal from '../components/ContactSupportModal'
import { GuideIcon } from '../components/GuideIcon'
import StillNeedHelp from '../components/StillNeedHelp'
import { guideText, readMinutes } from '../guides'
import { useApprovalRules } from '../hooks/useApprovalRules'
import { libraryFor } from '../library'
import { usePageTitle } from '@/hooks/usePageTitle'

/**
 * The Help & guides center of the Accounting Officer (/officer/help; Framer ylRPv8gjJ + menNRI3in Contact support) and,
 * since 2026-11-27, of the Supervisor / Manager (/supervisor/help; Framer cR3NPU8IK + mZNmzhDdX): the signed-in role picks
 * the guide set, categories and rules card (library.js).
 * Search (in the browser), 4 category cards (?category= filters the list), popular guides, "Review rules at a
 * glance" from the live approval rules, and "Still stuck?" with the company's real Admin(s). ?contact=1 opens
 * Contact support.
 * Code differs from the frames (real data only): no "▶ Reviewer / Approver walkthrough" (there's no video); "Still stuck?"
 * names your company's Admin instead of a "finance systems team" with a 1-day reply promise; "Flags" not "AI flags".
 */
export default function ReviewerHelpPage() {
  usePageTitle('Help & guides')
  const user = useAuthStore((s) => s.user)
  const lib = libraryFor(user?.role)
  const rules = useApprovalRules()
  const [params, setParams] = useSearchParams()
  const category = params.get('category')
  const contactOpen = params.get('contact') === '1'
  const setParam = (k, v) =>
    setParams(
      (p) => {
        if (v) p.set(k, v)
        else p.delete(k)
        return p
      },
      { replace: true },
    )
  const [query, setQuery] = useState('')
  const results = useMemo(() => search(lib.guides, query, rules), [lib, query, rules])
  const listed = category ? lib.guides.filter((g) => g.category === category) : lib.guides.filter((g) => g.popular)
  const activeCategory = lib.categories.find((c) => c.key === category)

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-[18px] px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">Help &amp; guides</h1>
          <p className="text-body text-muted-foreground">{lib.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setParam('contact', '1')}
          className="text-auth-button flex h-[38px] items-center gap-1.5 rounded-lg bg-primary px-4 text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Mail className="size-4" aria-hidden="true" /> Contact support
        </button>
      </div>

      <section className="flex flex-col gap-2.5 rounded-xl bg-primary-dark px-[22px] py-5" aria-labelledby="help-search">
        <h2 id="help-search" className="text-body-strong text-white">
          How can we help{user?.first_name ? `, ${user.first_name}` : ''}?
        </h2>
        <div className="relative">
          <div className="flex h-11 items-center gap-2 rounded-lg bg-card px-3.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lib.searchHint}
              aria-label="Search guides"
              maxLength={80}
              className="text-body w-full bg-transparent outline-none placeholder:text-muted-foreground"
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
                  <button type="button" onClick={() => setParam('contact', '1')} className="text-auth-link text-primary hover:underline">
                    Ask your Admin
                  </button>
                </p>
              ) : (
                <ul>
                  {results.map((g) => (
                    <li key={g.slug} className="border-b last:border-b-0">
                      <Link to={lib.link(g.slug)} className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-muted">
                        <span className="text-body-strong">{g.title}</span>
                        <span className="text-caption">{g.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="list" aria-label="Guide topics">
        {lib.categories.map((c) => {
          const count = lib.guides.filter((g) => g.category === c.key).length
          const on = category === c.key
          return (
            <button
              key={c.key}
              type="button"
              role="listitem"
              aria-pressed={on}
              onClick={() => setParam('category', on ? null : c.key)}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-4 text-left outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/50',
                on ? 'border-primary bg-primary-faint' : 'bg-card',
              )}
            >
              <GuideIcon guide={c} />
              <span className="text-card-title">{c.label}</span>
              <span className="text-caption">
                {c.blurb} · {count} {count === 1 ? 'guide' : 'guides'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card" aria-labelledby="guide-list">
          <div className="flex items-center justify-between gap-2 border-b px-[18px] pt-3.5 pb-3">
            <h2 id="guide-list" className="text-card-title">
              {activeCategory ? activeCategory.label : 'Popular guides'}
            </h2>
            {activeCategory && (
              <button type="button" onClick={() => setParam('category', null)} className="text-auth-link text-primary hover:underline">
                Show popular
              </button>
            )}
          </div>
          <ul>
            {listed.map((g) => (
              <li key={g.slug} className="border-b last:border-b-0">
                <Link
                  to={lib.link(g.slug)}
                  className="flex items-center gap-3 px-[18px] py-3 outline-none hover:bg-muted focus-visible:bg-muted"
                >
                  <GuideIcon guide={g} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-strong">{g.title}</span>
                    <span className="text-caption truncate">{g.summary}</span>
                  </span>
                  <span className="text-caption shrink-0">{readMinutes(g)} min</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex w-full flex-col gap-3.5 lg:w-[300px] lg:shrink-0">
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-[18px]" aria-labelledby="rules-glance">
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-primary" aria-hidden="true" />
              <h2 id="rules-glance" className="text-card-title">
                {lib.rulesTitle}
              </h2>
            </div>
            <ul className="text-body flex list-disc flex-col gap-1.5 pl-5">
              {lib.rulesAtAGlance(rules).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="text-caption">From the Super Admin’s Global settings{rules ? '' : ' (loading the current values…)'}.</p>
          </section>
          <StillNeedHelp onContact={() => setParam('contact', '1')} />
        </div>
      </div>

      <AnimatePresence>{contactOpen && <ContactSupportModal onClose={() => setParam('contact', null)} />}</AnimatePresence>
    </div>
  )
}

/** Guides whose text contains every typed word (2+ letters). */
function search(guides, query, rules) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
  if (!words.length) return []
  return guides
    .filter((g) => {
      const text = guideText(g, rules).toLowerCase()
      return words.every((w) => text.includes(w))
    })
    .slice(0, 8)
}
