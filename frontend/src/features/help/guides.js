import { ArrowLeftRight, FilePen, Plus, Sparkles, Undo2, Users } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { formatMoney } from '@/lib/formatters'

/**
 * The clerk's Help & guides articles (Framer V0J_GkScn cards, HZsDzsZaH article), written 2026-11-26.
 * RULE: every sentence describes what ADVMS does TODAY. Anything not built yet says so plainly
 * (the AI guide carries a "not switched on yet" note). Update an article when its feature changes,
 * and move its `updated` date.
 *
 * `needsReviewing`: the guide shows the "reviewing isn't switched on yet" note while rules.reviewing_live is false.
 * Blocks: { p } paragraph · { list, ordered } · { note, tone: info|warning|success, title } ·
 * { flow: [{ label, tone }] } · { links: [{ to, label }] }. A block may be a function of the live
 * approval rules (`rules` = GET /approval-rules, or null while loading / if it failed).
 */

const threshold = (rules) => (rules ? formatMoney(rules.high_value_threshold) : 'the high-value amount')

export const GUIDES = [
  {
    slug: 'create-a-voucher',
    title: 'Create your first voucher',
    summary: 'Fill in the payee, details, payment and lines, then save or submit. 4 sections.',
    category: 'Getting started',
    icon: Plus,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: false,
    sections: [
      {
        id: 'start',
        title: 'Start a voucher',
        blocks: [
          {
            p: 'Click Create voucher in the menu. The voucher belongs to the company shown in “Working in” at the top, so check it first.',
          },
          {
            p: 'The form has 4 sections. A draft can be saved half-done; everything is checked when you submit.',
          },
        ],
      },
      {
        id: 'sections',
        title: 'The 4 sections',
        blocks: [
          {
            list: [
              'Payee: who gets paid and their payee type. Start typing a saved payee and pick it: its type, payment method and bank details fill in for you.',
              'Details: the category, and what the voucher is for (description or purpose). Voucher type, department, due date, priority and a reference number are optional.',
              'Payment: cash, bank transfer or check. A bank transfer needs the bank, account number and account name.',
              'Lines: each item with a quantity, unit and unit price. The total is added up for you (the server adds it again, to the centavo). Up to 50 lines.',
            ],
            ordered: true,
          },
        ],
      },
      {
        id: 'save-or-submit',
        title: 'Save or submit',
        blocks: [
          {
            list: [
              'Save draft keeps it private to you. While you edit a draft, it also saves itself every 30 seconds.',
              'Save & submit sends it to the Accounting Officers. If something is missing, it stays a draft and the missing fields are marked.',
              'On submit the voucher gets its number, like ABC-2026-0001, and keeps it from then on.',
            ],
          },
          {
            note: 'Drafts are deleted after 30 days without changes. You get a reminder in the bell 3 days before.',
            tone: 'warning',
          },
          { note: 'Attaching receipts and invoices comes in an upcoming update.', tone: 'info' },
        ],
      },
    ],
    related: ['fixing-returned-vouchers', 'using-payees'],
  },
  {
    slug: 'why-ai-flagged',
    title: 'Why was my voucher flagged?',
    summary: 'How the automatic check works and what happens next.',
    category: 'AI & automation',
    icon: Sparkles,
    tone: 'ai',
    updated: 'Nov 2026',
    popular: true,
    sections: [
      {
        id: 'what-a-flag-means',
        title: 'What a flag means',
        blocks: [
          {
            p: 'Right after you submit, ADVMS compares the voucher with past spending for the same department, payee and category. If something looks unusual, the voucher is marked “Flagged” with a score from 0 to 1 and a short reason, and Accounting looks at it more closely.',
          },
          { p: 'A flag is not a rejection. A person still reviews every voucher, and Accounting can clear a flag as a false alarm.' },
          { note: 'For now the check is a set of plain rules. An AI model comes in a later update.', tone: 'info' },
          {
            note: '“Amount is 2.4× the 6-month average for IT equipment in Finance Operations.”',
            title: 'Example of a reason (not a real voucher)',
            tone: 'warning',
          },
        ],
      },
      {
        id: 'common-reasons',
        title: 'Common reasons',
        blocks: [
          {
            list: [
              'The amount is much higher than usual for the department or payee.',
              'A similar voucher (same payee, close amount) was submitted recently.',
              'The category is unusual for this payee.',
              'Approving it would pass the department’s budget alert level this month.',
              'It is a large first payment to a payee the company has never paid.',
            ],
            ordered: true,
          },
          { p: 'Which checks run, and how strict they are, is set by the platform owner.' },
        ],
      },
      {
        id: 'what-happens-next',
        title: 'What happens next',
        blocks: [
          (rules) => ({
            flow: [
              { label: 'You submit', tone: 'neutral' },
              { label: 'Accounting review', tone: 'primary' },
              ...(rules?.ai_flagged_needs_step2 === false ? [] : [{ label: 'Supervisor final approval', tone: 'warning' }]),
              { label: 'Approved', tone: 'success' },
            ],
          }),
          (rules) => ({
            p:
              rules?.ai_flagged_needs_step2 === false
                ? 'Right now a flag does not add a Supervisor step: Accounting decides, unless the total is ' +
                  threshold(rules) +
                  ' or more.'
                : 'A flagged voucher also needs a Supervisor / Manager’s final approval after Accounting, even below ' +
                  threshold(rules) +
                  '.',
          }),
          { p: 'The check runs in the background, so Submit never waits for it. A fixed and resubmitted voucher is checked again.' },
        ],
      },
      {
        id: 'tips',
        title: 'Tips to avoid flags',
        blocks: [
          {
            list: [
              'Write a clear description: what was bought, for whom, and for which period.',
              'Choose the category that matches what was bought.',
              'Use one voucher per purchase, and don’t submit the same bill twice.',
              'Pick the saved payee instead of typing a new spelling of the same name.',
            ],
          },
        ],
      },
    ],
    related: ['fixing-returned-vouchers', 'approval-route'],
  },
  {
    slug: 'fixing-returned-vouchers',
    title: 'Fixing returned vouchers',
    summary: 'Read the reviewer’s note, edit and resubmit.',
    category: 'Vouchers',
    icon: Undo2,
    tone: 'danger',
    updated: 'Nov 2026',
    popular: true,
    needsReviewing: true,
    sections: [
      {
        id: 'why-returned',
        title: 'Why a voucher comes back',
        blocks: [
          {
            p: 'An Accounting Officer (and, later, a Supervisor / Manager) can send a voucher back to you instead of rejecting it. They tick what needs changes (for example Line items or Amount) and write a note. You get a bell notice and an email, and the voucher appears in Returned to me.',
          },
        ],
      },
      {
        id: 'fix',
        title: 'Fix and resubmit',
        blocks: [
          {
            list: [
              'Open Returned to me and read the reviewer’s note and the “Needs changes” tags on the card.',
              'Click Fix & resubmit. The note stays at the top while you edit, and the summary shows the total now next to the total when it came back.',
              'Save changes keeps it with you. Resubmit for review sends it back.',
            ],
            ordered: true,
          },
          {
            note: 'A resubmitted voucher keeps its number and starts again with Accounting, even if a Supervisor returned it.',
            tone: 'info',
          },
          { p: 'If it shouldn’t be paid at all, open the voucher and click Cancel. A cancelled voucher stays in your history.' },
        ],
      },
    ],
    related: ['approval-route', 'create-a-voucher'],
  },
  {
    slug: 'switching-companies',
    title: 'Switching companies',
    summary: 'Work across the companies you have access to.',
    category: 'Your account',
    icon: ArrowLeftRight,
    tone: 'success',
    updated: 'Nov 2026',
    popular: false,
    sections: [
      {
        id: 'switch',
        title: 'Change the company you work in',
        blocks: [
          {
            p: 'Click “Working in …” at the top and choose another company. Vouchers, drafts, payees and the dashboard always show the company you’re working in.',
          },
        ],
      },
      {
        id: 'join',
        title: 'Join another company',
        blocks: [
          {
            list: [
              'In the same menu, choose Join another company… and ask to join. That company’s Admin approves or declines.',
              'An Admin can also invite you. Accept or decline the invitation in the same window.',
              'You can cancel a request while it’s waiting.',
            ],
          },
          {
            note: 'If a company is suspended, you can’t work in it until it’s reactivated. Your data there is kept.',
            tone: 'warning',
          },
        ],
      },
    ],
    related: ['using-payees'],
  },
  {
    slug: 'using-payees',
    title: 'Using payees',
    summary: 'Save the people and businesses you pay, and reuse them on vouchers.',
    category: 'Vouchers',
    icon: Users,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: false,
    sections: [
      {
        id: 'what',
        title: 'What payees are',
        blocks: [
          {
            p: 'Payees is your company’s shared list of people and businesses it pays: name, type, TIN, default payment and contact details. Every clerk in the company can add and edit it, and each change is recorded.',
          },
          { p: 'The numbers on the list (vouchers, approved this year, last used) count only your own vouchers.' },
        ],
      },
      {
        id: 'use',
        title: 'Use a payee on a voucher',
        blocks: [
          {
            list: [
              'On the voucher form, start typing the payee’s name and pick it from the list.',
              'Or open the payee in Payees and click New voucher for … .',
              'A name that isn’t saved is kept as typed. Add it in Payees to reuse it next time.',
            ],
          },
          { note: 'When you add a payee, ADVMS warns you if the name or TIN looks like one already on the list.', tone: 'info' },
        ],
      },
    ],
    related: ['create-a-voucher'],
  },
]

/** The approval route has its own live page (rules from Global settings). */
export const APPROVAL_GUIDE = {
  slug: 'approval-route',
  title: 'Approval route explained',
  summary: 'Who reviews your voucher, and when a Supervisor is needed.',
  to: PATHS.CLERK_APPROVAL_GUIDE,
  icon: FilePen,
}

export const guideBySlug = (slug) => GUIDES.find((g) => g.slug === slug)

export function guideLink(slug) {
  return slug === APPROVAL_GUIDE.slug ? APPROVAL_GUIDE.to : `${PATHS.CLERK_HELP}/${slug}`
}

export function guideTitle(slug) {
  return slug === APPROVAL_GUIDE.slug ? APPROVAL_GUIDE.title : guideBySlug(slug)?.title
}

/** Plain text of a guide (for search and the "N min read" estimate). */
export function guideText(guide, rules = null) {
  const parts = [guide.title, guide.summary, guide.category]
  guide.sections.forEach((s) => {
    parts.push(s.title)
    s.blocks.forEach((b) => {
      const block = typeof b === 'function' ? b(rules) : b
      if (block.p) parts.push(block.p)
      if (block.note) parts.push(block.note)
      if (block.list) parts.push(...block.list)
    })
  })
  return parts.join(' ')
}

export const readMinutes = (guide) => Math.max(1, Math.round(guideText(guide).split(/\s+/).length / 200))

/** FAQ on the help center. `a` may use the live rules. */
export const FAQS = [
  {
    q: 'Who approves my voucher?',
    a: (rules) =>
      `Accounting reviews every voucher first. Vouchers of ${threshold(rules)} or more${rules?.ai_flagged_needs_step2 === false ? '' : ' or flagged by the automatic check'} also need a Supervisor / Manager’s final approval.`,
  },
  {
    q: 'Can I edit a voucher after submitting?',
    a: () =>
      'Not while a reviewer has it. If they send it back, it appears in Returned to me and you can edit and resubmit it. Drafts can be edited any time.',
  },
  {
    q: 'Which receipts are accepted?',
    a: () =>
      'Attaching receipts and invoices isn’t available yet; it comes in an upcoming update. Until then, follow your company’s usual way of handing them in.',
  },
  {
    q: 'How is the AI category suggestion made?',
    a: () =>
      'It isn’t switched on yet. When it is, ADVMS will read your description and suggest a category with a confidence score. You always choose the category yourself.',
  },
  {
    q: 'Why was my draft deleted?',
    a: () =>
      'Drafts that aren’t changed for 30 days are deleted automatically. You get a bell reminder 3 days before. Any save, including auto-save, restarts the 30 days.',
  },
]
