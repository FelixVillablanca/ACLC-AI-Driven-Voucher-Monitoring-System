import { CheckSquare, Clock, FileBarChart, Flag, History, PieChart, ScrollText, Search, TrendingUp, Users } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { formatMoney } from '@/lib/formatters'

/**
 * The Supervisor / Manager's Help & guides (Framer cR3NPU8IK center, mZNmzhDdX Contact support), written 2026-11-27.
 * RULE (same as guides.js / officerGuides.js): every sentence describes what ADVMS does TODAY; anything not built says
 * so (e.g. there is no approval delegation). Update a guide when its feature changes and move its `updated` date.
 * Blocks: see guides.js. `action` = the article's primary button.
 */

const threshold = (rules) => (rules ? formatMoney(rules.high_value_threshold) : 'the high-value amount')
const signoffAbove = (rules) => (rules?.budget_signoff_above ? formatMoney(rules.budget_signoff_above) : 'the sign-off amount')

export const SUPERVISOR_CATEGORIES = [
  { key: 'approvals', label: 'Final approvals', blurb: 'Approve, return or reject at Level 2', icon: CheckSquare, tone: 'primary' },
  { key: 'flags', label: 'Flags', blurb: 'Investigate and approve flagged vouchers safely', icon: Flag, tone: 'danger' },
  { key: 'budgets', label: 'Budgets & forecasts', blurb: 'Budget changes and spending predictions', icon: PieChart, tone: 'warning' },
  { key: 'audit', label: 'Audit & reports', blurb: 'Audit trail and report sign-off', icon: ScrollText, tone: 'success' },
]

export const SUPERVISOR_GUIDES = [
  // ── Final approvals ──────────────────────────────────────────────────────────
  {
    slug: 'level-2-decisions',
    title: 'Approve, return or reject at Level 2',
    summary: 'Your three choices, and what each one does to the voucher.',
    category: 'approvals',
    icon: CheckSquare,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: false,
    action: { to: PATHS.SUPERVISOR_QUEUE, label: 'Open approval queue' },
    related: ['which-reach-level-2', 'override-a-flag', 'when-away'],
    sections: [
      {
        id: 'choices',
        title: 'Your three choices',
        blocks: [
          { p: 'Accounting has already approved the voucher at Level 1. Yours is the final decision.' },
          {
            flow: [
              { label: 'Final approve → released for payment', tone: 'success' },
              { label: 'Return → clerk or Accounting fixes it', tone: 'warning' },
              { label: 'Reject (final)', tone: 'neutral' },
            ],
          },
        ],
      },
      {
        id: 'approve',
        title: 'Final approve',
        blocks: [
          {
            p: 'The voucher becomes Approved and its amount is added to the department’s budget for the fiscal year. If that pushes the department past its alert level, Accounting gets a budget alert. This can’t be undone.',
          },
          { p: 'Remarks are optional, except for a flagged voucher: then you must say why you approve it anyway.' },
        ],
      },
      {
        id: 'return',
        title: 'Return: to the clerk or to Accounting',
        blocks: [
          {
            list: [
              'Back to the clerk: when the voucher itself needs fixing (payee, description, lines). The clerk edits it and submits again; it goes through Level 1 again.',
              'Back to Accounting: when the Level 1 review missed something. It returns to the Accounting Officer’s queue with your note.',
            ],
          },
          { p: 'Either way, tick what needs changes and write remarks. Both are required.' },
        ],
      },
      {
        id: 'reject',
        title: 'Reject',
        blocks: [{ p: 'Pick a reason and write remarks. The voucher is closed for good and the clerk is told by bell notice and email.' }],
      },
    ],
  },
  {
    slug: 'which-reach-level-2',
    title: 'Which vouchers reach you',
    summary: 'The two rules that send a voucher to Level 2.',
    category: 'approvals',
    icon: Users,
    tone: 'primary',
    updated: 'Nov 2026',
    action: { to: PATHS.SUPERVISOR_QUEUE, label: 'Open approval queue' },
    related: ['level-2-decisions', 'override-a-flag'],
    sections: [
      {
        id: 'rules',
        title: 'The rules',
        blocks: [
          (rules) => ({
            list: [
              'Every voucher Accounting approves comes to you: your approval is always the final one.',
              `${threshold(rules)} or more: marked “High value”.`,
              'Flagged by the automatic check: marked “Flagged” (unless Accounting cleared the flag as a false alarm).',
            ],
          }),
          {
            p: 'Once you approve, the clerk gets a notice with the payment PDF and can email the payee. For a cheque payment the clerk records the cheque afterwards; Cheques in your menu shows every cheque of the company (read-only).',
          },
          {
            note: 'These rules come from the Super Admin’s Global settings and are read at the moment Accounting approves. A change doesn’t move vouchers that are already in your queue.',
            tone: 'info',
          },
        ],
      },
    ],
  },
  {
    slug: 'bulk-approve',
    title: 'Approving several vouchers at once',
    summary: 'Select in the approval queue; flagged vouchers are left out on purpose.',
    category: 'approvals',
    icon: CheckSquare,
    tone: 'primary',
    updated: 'Nov 2026',
    action: { to: PATHS.SUPERVISOR_QUEUE, label: 'Open approval queue' },
    related: ['level-2-decisions'],
    sections: [
      {
        id: 'how',
        title: 'How it works',
        blocks: [
          {
            list: [
              'In the approval queue, tick the vouchers you’ve checked (up to 50).',
              'Click Approve selected and confirm.',
              'All of them are approved together, or none are: if one was decided by someone else in the meantime, nothing changes and the list reloads.',
            ],
            ordered: true,
          },
          { note: 'Flagged vouchers can’t be bulk-approved: each one needs its own remarks.', tone: 'warning' },
        ],
      },
    ],
  },
  {
    slug: 'decision-history',
    title: 'Your decision history',
    summary: 'Every Level 2 decision you made, by month, with an export.',
    category: 'approvals',
    icon: History,
    tone: 'primary',
    updated: 'Nov 2026',
    action: { to: PATHS.SUPERVISOR_HISTORY, label: 'Open decision history' },
    related: ['audit-trail'],
    sections: [
      {
        id: 'read',
        title: 'What it shows',
        blocks: [
          {
            list: [
              'Decisions this month: approved, returned and rejected.',
              'Average decision time: from Accounting’s Level 1 approval to your decision, compared with the month before.',
              'Flags overridden: flagged vouchers you approved, and whether each has written remarks.',
            ],
          },
          {
            p: 'Pick another month (or All months), filter by decision, search by voucher number or payee, and Export CSV saves exactly what is shown.',
          },
        ],
      },
    ],
  },
  {
    slug: 'when-away',
    title: 'When you’re away (there’s no delegation yet)',
    summary: 'Who decides Level 2 vouchers while you’re on leave.',
    category: 'approvals',
    icon: Clock,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: true,
    related: ['which-reach-level-2'],
    sections: [
      {
        id: 'today',
        title: 'How it works today',
        blocks: [
          {
            note: 'ADVMS doesn’t have approval delegation (handing your approvals to someone for a set period). It isn’t built yet.',
            tone: 'warning',
          },
          {
            p: 'Every Supervisor / Manager who has access to the company sees the same Level 2 queue and can decide any voucher in it. So while you’re away, another Supervisor of the company can keep things moving.',
          },
          {
            list: [
              'If nobody else is a Supervisor of the company, ask your company’s Admin to give a colleague Supervisor access (Contact support → Company access).',
              'Nobody can approve a voucher they created themselves, whoever is covering.',
            ],
          },
        ],
      },
    ],
  },

  // ── Flags ────────────────────────────────────────────────────────────────────
  {
    slug: 'override-a-flag',
    title: 'When to approve a flagged voucher',
    summary: 'A flag is a signal, not a verdict: check the reason, then decide with remarks.',
    category: 'flags',
    icon: Flag,
    tone: 'danger',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.SUPERVISOR_FLAGGED, label: 'Open flagged vouchers' },
    related: ['investigate-a-flag', 'flag-score'],
    sections: [
      {
        id: 'check',
        title: 'Check before you approve',
        blocks: [
          {
            list: [
              'Read why it was flagged (the tiles on the Investigate page).',
              'Look at past vouchers to the same payee: a repeat for a similar amount can be a duplicate.',
              'Check the budget impact: how far the department would go.',
              'Read Accounting’s Level 1 remarks.',
            ],
            ordered: true,
          },
        ],
      },
      {
        id: 'approve',
        title: 'If it’s fine',
        blocks: [
          {
            p: 'Approve it and say why in the remarks (required for flagged vouchers), for example “Six laptops replace units past warranty; quotation attached to the file.” Your remarks go to the voucher’s approval trail, and the decision shows as “Approved while flagged” in your decision history.',
          },
        ],
      },
      {
        id: 'not',
        title: 'If it isn’t',
        blocks: [{ p: 'Return it to the clerk or to Accounting with what to fix, or reject it with a reason.' }],
      },
    ],
  },
  {
    slug: 'investigate-a-flag',
    title: 'Investigating a flag',
    summary: 'What each part of the Investigate page tells you.',
    category: 'flags',
    icon: Search,
    tone: 'danger',
    updated: 'Nov 2026',
    action: { to: PATHS.SUPERVISOR_FLAGGED, label: 'Open flagged vouchers' },
    related: ['override-a-flag', 'flag-score'],
    sections: [
      {
        id: 'parts',
        title: 'The page',
        blocks: [
          {
            list: [
              'Why it was flagged: one tile per thing the check looked at, red or amber when it stood out, with what’s normal.',
              'Past vouchers to the payee: the payee’s other vouchers in this company with their status.',
              'Approval trail: who submitted it and who approved Level 1, with their remarks.',
              'Budget impact: the department’s use of its yearly budget now and after approving.',
            ],
          },
          { p: 'You decide right there, with the same windows as the final review.' },
        ],
      },
    ],
  },
  {
    slug: 'flag-score',
    title: 'What the flag score means',
    summary: 'How the automatic check scores a voucher, and why it isn’t AI yet.',
    category: 'flags',
    icon: Flag,
    tone: 'danger',
    updated: 'Nov 2026',
    related: ['override-a-flag'],
    sections: [
      {
        id: 'check',
        title: 'The automatic check',
        blocks: [
          {
            p: 'Right after a voucher is submitted, a rule-based check looks at five things: the amount against the department’s usual spending for the category, a possible duplicate to the same payee, a category unusual for the payee, the budget after approval, and a large first payment to a new payee. Each adds to a score from 0 to 1.',
          },
          {
            p: 'Above the line set by the Super Admin (the “sensitivity” setting) the voucher is flagged. The Flagged page also shows how flags of the last 90 days ended.',
          },
          {
            note: 'The machine-learning model (the “AI” in the designs) isn’t built yet. Until it is, the screens say “Flagged” and “Automatic check”.',
            tone: 'info',
          },
        ],
      },
    ],
  },

  // ── Budgets & forecasts ──────────────────────────────────────────────────────
  {
    slug: 'approve-top-up',
    title: 'Approving a budget change',
    summary: 'Accounting’s big budget changes wait for you: approve all, part or decline.',
    category: 'budgets',
    icon: PieChart,
    tone: 'warning',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.SUPERVISOR_BUDGETS, label: 'Open budgets' },
    related: ['reading-budgets', 'forecasts'],
    sections: [
      {
        id: 'when',
        title: 'When a change needs you',
        blocks: [
          (rules) => ({
            p: `Accounting sets each department’s yearly budget. A change of more than ${signoffAbove(rules)} isn’t applied straight away: it waits on your Budgets page (and you get a bell notice).`,
          }),
        ],
      },
      {
        id: 'decide',
        title: 'Deciding',
        blocks: [
          {
            list: [
              'Click Review: you see the budget now and after the change, how much of each is used, Accounting’s reason and, when there is one, the forecast for the department.',
              'Approve the full top-up, or type a smaller one. You can’t approve more than was asked.',
              'Or Decline with a reason (required).',
            ],
            ordered: true,
          },
          {
            p: 'Accounting gets a bell notice either way, and the decision is in the audit trail. You can’t decide a change you asked for yourself.',
          },
        ],
      },
    ],
  },
  {
    slug: 'reading-budgets',
    title: 'Reading the Budgets page',
    summary: 'Totals, use per department and alerts, for each fiscal year.',
    category: 'budgets',
    icon: PieChart,
    tone: 'warning',
    updated: 'Nov 2026',
    action: { to: PATHS.SUPERVISOR_BUDGETS, label: 'Open budgets' },
    related: ['approve-top-up'],
    sections: [
      {
        id: 'read',
        title: 'What it shows',
        blocks: [
          {
            list: [
              'Total allocated and used so far for the fiscal year (pick another year at the top).',
              'One bar per department; “alert” means it passed the alert level Accounting set.',
              '“Used” = vouchers that got their final approval. Vouchers still in review aren’t counted yet.',
            ],
          },
          { p: 'Budgets are read-only for you: Accounting changes them, and big changes come to you for sign-off.' },
        ],
      },
    ],
  },
  {
    slug: 'forecasts',
    title: 'Reading forecasts',
    summary: 'Next month, the year-end projection and how sure the forecast is.',
    category: 'budgets',
    icon: TrendingUp,
    tone: 'warning',
    updated: 'Nov 2026',
    action: { to: PATHS.SUPERVISOR_FORECASTS, label: 'Open forecasts' },
    related: ['approve-top-up'],
    sections: [
      {
        id: 'how',
        title: 'How they’re made',
        blocks: [
          {
            p: 'A straight line is drawn through each month’s approved spending (at least 3 months are needed) and carried forward. They’re worked out again on the 1st of every month.',
          },
          {
            list: [
              'Next month: the forecast and the likely range.',
              'Year-end projection: approved so far this fiscal year plus what’s still expected, against the budgets. When the forecasts stop before the year ends, it says “through” that month.',
              'Confidence: how well the line fits past spending (R²) and how many months it used.',
            ],
          },
          { note: 'Forecasts are estimates, not limits, and they’re not AI yet (the machine-learning model comes later).', tone: 'info' },
        ],
      },
    ],
  },

  // ── Audit & reports ──────────────────────────────────────────────────────────
  {
    slug: 'audit-trail',
    title: 'Reading the audit trail',
    summary: 'Who changed what in vouchers, budgets and approvals, and when.',
    category: 'audit',
    icon: ScrollText,
    tone: 'success',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.SUPERVISOR_AUDIT, label: 'Open audit trail' },
    related: ['decision-history', 'report-signoff'],
    sections: [
      {
        id: 'what',
        title: 'What’s in it',
        blocks: [
          {
            p: 'Every voucher, approval, budget, report and forecast event of the company you’re working in, newest first. Sign-ins, users and settings stay with the Admin. Entries can’t be edited or deleted.',
          },
          {
            list: [
              'Pick the dates, search by person, voucher number or IP address, and filter by user, action or table.',
              'Click a row for the details: the exact time, the IP address and what changed (old → new).',
              '⚑ marks sensitive changes such as budget edits.',
              'Export log saves what you filtered as a CSV file (the export is recorded too).',
            ],
          },
          {
            p: 'Each entry has a fingerprint. “Untouched since it was written” means nobody changed it in the database afterwards.',
          },
        ],
      },
    ],
  },
  {
    slug: 'report-signoff',
    title: 'Signing off monthly reports',
    summary: 'Company-wide monthly and quarterly reports wait for your sign-off.',
    category: 'audit',
    icon: FileBarChart,
    tone: 'success',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.SUPERVISOR_REPORTS, label: 'Open financial reports' },
    related: ['audit-trail'],
    sections: [
      {
        id: 'which',
        title: 'Which reports',
        blocks: [
          {
            p: 'Accounting makes the reports, and a monthly one is made automatically on the 1st. Company-wide monthly and quarterly reports wait for a Supervisor’s sign-off; department reports don’t.',
          },
        ],
      },
      {
        id: 'checklist',
        title: 'The checklist',
        blocks: [
          {
            list: [
              'Totals match the approved vouchers: ADVMS adds them up again now. If vouchers were approved since the report was made, it warns you; send it back so Accounting makes a fresh one.',
              'AI summary reviewed: tick it once you’ve read the summary (needed when there is one).',
              'Open flags noted for the board: needed when flagged vouchers were still open.',
            ],
          },
          {
            p: 'Add comments for the board if you like, then Sign off report. The sign-off is printed on the PDF. Or Send back to Accounting with what to fix (required).',
          },
        ],
      },
    ],
  },
]

export const supervisorGuideBySlug = (slug) => SUPERVISOR_GUIDES.find((g) => g.slug === slug)
export const supervisorGuideLink = (slug) => `${PATHS.SUPERVISOR_HELP}/${slug}`
export const supervisorGuideTitle = (slug) => supervisorGuideBySlug(slug)?.title

/** "Level 2 rules at a glance" (Framer cR3NPU8IK side card), from the live rules. */
export function level2RulesAtAGlance(rules) {
  return [
    'Every voucher → your final approval is required',
    `${threshold(rules)} or more → marked “High value”`,
    'Approving a flagged voucher needs written remarks',
    `Budget changes over ${signoffAbove(rules)} → your sign-off`,
    'Company-wide monthly / quarterly reports → your sign-off',
  ]
}
