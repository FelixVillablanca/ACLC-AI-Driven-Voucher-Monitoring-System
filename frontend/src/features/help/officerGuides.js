import { CheckSquare, FileBarChart, Flag, PieChart, TrendingUp, Undo2, Users } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import { formatMoney } from '@/lib/formatters'

/**
 * The Accounting Officer's Help & guides (Framer ylRPv8gjJ center, fXCag8TBS article), written 2026-11-27.
 * RULE (same as the clerk's guides.js): every sentence describes what ADVMS does TODAY; anything not built says so.
 * Update a guide when its feature changes and move its `updated` date. Blocks: see guides.js.
 * `action` = the article's primary button (Framer: "Open review queue").
 */

const threshold = (rules) => (rules ? formatMoney(rules.high_value_threshold) : 'the high-value amount')
const flaggedGoesUp = (rules) => rules?.ai_flagged_needs_step2 !== false
const sla = (rules) => (rules?.review_sla_hours ? `${rules.review_sla_hours} hours` : 'the review time set by the Super Admin')

export const OFFICER_CATEGORIES = [
  { key: 'review', label: 'Reviewing vouchers', blurb: 'Approve, return or reject at Level 1', icon: CheckSquare, tone: 'primary' },
  { key: 'flags', label: 'Flags', blurb: 'What the automatic check’s score means', icon: Flag, tone: 'danger' },
  { key: 'budgets', label: 'Budgets & forecasts', blurb: 'Allocations, alerts and predictions', icon: PieChart, tone: 'warning' },
  { key: 'reports', label: 'Financial reports', blurb: 'Generate, download and the AI summary', icon: FileBarChart, tone: 'success' },
]

export const OFFICER_GUIDES = [
  {
    slug: 'return-or-reject',
    title: 'When to return a voucher instead of rejecting it',
    summary: 'Returning keeps the voucher alive; rejecting closes it for good.',
    category: 'review',
    icon: Undo2,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.OFFICER_QUEUE, label: 'Open review queue' },
    related: ['which-go-to-level-2', 'reading-the-flag', 'review-queue'],
    sections: [
      {
        id: 'choices',
        title: 'Your three choices',
        blocks: [
          {
            p: 'At Level 1 you approve, return to the clerk, or reject. Returning keeps the voucher alive: the clerk fixes it and sends it back to you. Rejecting closes it for good.',
          },
          {
            flow: [
              { label: 'Approve', tone: 'success' },
              { label: 'Return → clerk fixes → back to you', tone: 'warning' },
              { label: 'Reject (final)', tone: 'neutral' },
            ],
          },
        ],
      },
      {
        id: 'return',
        title: 'Return it when the problem can be fixed',
        blocks: [
          { p: 'Tick what needs changes. The clerk sees these tags on their Returned to me card and on the form:' },
          {
            list: [
              'Payee: the wrong payee or payee type',
              'Description: what it’s for is unclear',
              'Category: the wrong category or department',
              'Line items: the lines don’t match what was bought',
              'Amount: the total is wrong',
              'Payment details: the method or bank details are wrong',
            ],
          },
          {
            note: 'Attaching receipts isn’t available yet, so “missing receipt” isn’t a tag. Say it in your remarks if you need one handed in.',
            tone: 'info',
          },
        ],
      },
      {
        id: 'reject',
        title: 'Reject it when the expense should not be paid',
        blocks: [
          { p: 'Pick one reason. Use Reject only when fixing the voucher can’t make it payable:' },
          {
            list: [
              'Duplicate of another voucher (the review page shows similar vouchers from the same payee)',
              'Not a valid business expense',
              'Not allowed by company policy',
              'No budget for this expense',
              'Other reason',
            ],
          },
        ],
      },
      {
        id: 'remarks',
        title: 'Writing good remarks',
        blocks: [
          {
            note: 'Both Return and Reject need remarks. The clerk gets exactly what you write, in ADVMS and by email, so say what to fix, not just “incomplete”.',
            tone: 'warning',
            title: 'Remember',
          },
          {
            p: 'A decision can’t be undone. A returned voucher comes back to your queue marked “Resubmitted” once the clerk sends it again.',
          },
        ],
      },
    ],
  },
  {
    slug: 'which-go-to-level-2',
    title: 'Which vouchers go to the Supervisor (Level 2)',
    summary: 'High-value and flagged vouchers need a second approval.',
    category: 'review',
    icon: Users,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.OFFICER_QUEUE, label: 'Open review queue' },
    related: ['return-or-reject', 'reading-the-flag'],
    sections: [
      {
        id: 'rule',
        title: 'The rule',
        blocks: [
          (rules) => ({
            list: [
              `A voucher of ${threshold(rules)} or more needs the Supervisor / Manager after you approve it.`,
              flaggedGoesUp(rules)
                ? 'A voucher the automatic check flagged also needs the Supervisor, whatever the amount (unless you marked the flag a false alarm).'
                : 'Flagged vouchers don’t need the Supervisor because of the flag (the Super Admin turned that rule off).',
              'Everything else is final when you approve it.',
            ],
          }),
          {
            p: 'The rule is read at the moment you approve, from the Super Admin’s Global settings. The Approve window tells you before you confirm whether your approval is final or the voucher goes on to the Supervisor, and why.',
          },
        ],
      },
      {
        id: 'after',
        title: 'What happens next',
        blocks: [
          {
            p: 'The voucher moves to “With the Supervisor” and every Supervisor of the company gets a bell notice. The clerk is told it passed Accounting.',
          },
          {
            note: 'The Supervisor’s approval screens come in an upcoming update. Until then, vouchers sent to Level 2 wait there.',
            tone: 'info',
            title: 'Not fully live yet',
          },
        ],
      },
    ],
  },
  {
    slug: 'review-queue',
    title: 'Working through the review queue',
    summary: 'Oldest first, the review time, tabs and bulk approve.',
    category: 'review',
    icon: CheckSquare,
    tone: 'primary',
    updated: 'Nov 2026',
    popular: false,
    action: { to: PATHS.OFFICER_QUEUE, label: 'Open review queue' },
    related: ['return-or-reject'],
    sections: [
      {
        id: 'order',
        title: 'Order and tabs',
        blocks: [
          {
            p: 'The queue lists every voucher waiting for Level 1 in the company you’re working in, oldest first. Tabs: All, Flagged, High value, Near SLA (close to the review time) and Resubmitted.',
          },
          (rules) => ({
            p: `Vouchers should be reviewed within ${sla(rules)}. Past 75% of that time they show ⏱. It’s a warning only: nothing is cancelled.`,
          }),
        ],
      },
      {
        id: 'bulk',
        title: 'Bulk approve',
        blocks: [
          {
            p: 'Select several normal vouchers and approve them together. Flagged vouchers can’t be bulk-approved: each needs its own look. It’s all or nothing: if one was already decided by someone else, nothing is approved and the list reloads.',
          },
        ],
      },
      {
        id: 'own',
        title: 'Your own vouchers',
        blocks: [{ p: 'Nobody can review a voucher they created (segregation of duties). Another officer has to review it.' }],
      },
    ],
  },
  {
    slug: 'reading-the-flag',
    title: 'Reading the automatic check’s score and reason',
    summary: 'Why a voucher was flagged, and what to do about it.',
    category: 'flags',
    icon: Flag,
    tone: 'danger',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.OFFICER_FLAGGED, label: 'Open flagged vouchers' },
    related: ['which-go-to-level-2', 'return-or-reject'],
    sections: [
      {
        id: 'what',
        title: 'What the check looks at',
        blocks: [
          {
            note: 'Right now the check is a set of plain rules, not AI. The AI model planned for later will replace the score.',
            tone: 'info',
            title: 'Not AI yet',
          },
          { p: 'After every submission it compares the voucher with the company’s history and gives a score from 0 to 1:' },
          {
            list: [
              'Amount: far above this department’s 6-month average for the category',
              'Possible duplicate: the same payee with a similar amount in the 45 days before',
              'Category: rare for this payee',
              'Budget: approving it would pass the department’s budget alert',
              'New payee: a large first payment',
            ],
          },
        ],
      },
      {
        id: 'score',
        title: 'When it flags',
        blocks: [
          {
            p: 'A voucher is flagged at a score of 0.70 or more (Relaxed), 0.60 (Balanced) or 0.45 (Strict). The Super Admin picks the sensitivity. The reason line names the strongest signals.',
          },
        ],
      },
      {
        id: 'finding',
        title: 'Your finding',
        blocks: [
          {
            list: [
              'Valid but high: approve it anyway (the finding is saved with the approval)',
              'Needs changes: return it to the clerk',
              'False alarm: the flag is cleared and it carries on as a normal voucher',
            ],
          },
          { p: 'Findings are kept, so later checks (and the AI model) can learn which flags were right.' },
        ],
      },
    ],
  },
  {
    slug: 'change-budget-allocation',
    title: 'Changing a department’s budget allocation',
    summary: 'Yearly budgets, alerts, and when a Supervisor must sign off.',
    category: 'budgets',
    icon: PieChart,
    tone: 'warning',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.OFFICER_BUDGETS, label: 'Open budgets' },
    related: ['how-forecasts-work'],
    sections: [
      {
        id: 'yearly',
        title: 'One budget per department per year',
        blocks: [
          {
            p: 'Each department gets one budget for the fiscal year. “Used” grows by itself when a voucher of that department gets its FINAL approval. Vouchers still in review show as “Pending in queue”.',
          },
          { p: 'A new budget starts with what the department already had approved that year.' },
        ],
      },
      {
        id: 'edit',
        title: 'Edit allocation',
        blocks: [
          {
            list: [
              'Open the department in Budgets and click Edit allocation (or ✎ in the list).',
              'Type the new amount and, if you like, a new alert %. A reason is required: it’s kept in the change history.',
              'Save.',
            ],
            ordered: true,
          },
          {
            note: 'A change of the amount bigger than the sign-off limit (₱250,000.00 unless the Super Admin changed it) isn’t applied at once: it waits for a Supervisor’s sign-off and shows as “Change waiting”. You can cancel your own request.',
            tone: 'warning',
            title: 'Big changes need sign-off',
          },
        ],
      },
      {
        id: 'alerts',
        title: 'Alerts',
        blocks: [
          {
            p: 'When usage passes the alert % (or 100%), the company’s Accounting Officers and the department head get a bell notice. Going over budget never blocks an approval: the review page warns you first.',
          },
        ],
      },
    ],
  },
  {
    slug: 'how-forecasts-work',
    title: 'How spending forecasts are calculated',
    summary: 'A trend line through past spending, its range and risk.',
    category: 'budgets',
    icon: TrendingUp,
    tone: 'warning',
    updated: 'Nov 2026',
    popular: true,
    action: { to: PATHS.OFFICER_FORECASTS, label: 'Open forecasts' },
    related: ['change-budget-allocation'],
    sections: [
      {
        id: 'method',
        title: 'The method',
        blocks: [
          {
            p: 'ADVMS adds up each department’s approved spending per month (up to 24 finished months) and draws the straight line closest to those months (linear regression). The line is continued into the next months.',
          },
          {
            note: 'This is a statistics formula worked out in ADVMS, not the AI model yet. That’s why the menu says “Forecasts”.',
            tone: 'info',
          },
        ],
      },
      {
        id: 'reading',
        title: 'Reading a forecast',
        blocks: [
          {
            list: [
              'Range: spending should land inside it about 4 times out of 5 if the trend continues',
              'Confidence: lower when the past months jumped around',
              'R²: how well the line follows the past months (1.00 = perfect)',
              'Risk: what’s still expected until the fiscal year ends vs the budget left: Over, Tight (85%+) or On track',
            ],
          },
          {
            p: 'It needs at least 3 months of approved vouchers. It’s worked out again on the 1st of each month, or when you press Recalculate. One-off purchases and seasons aren’t predicted by a straight line, so check “What’s driving it”.',
          },
        ],
      },
    ],
  },
  {
    slug: 'generate-a-report',
    title: 'Generating a financial report',
    summary: 'Monthly, quarterly or department reports, downloads and the AI summary.',
    category: 'reports',
    icon: FileBarChart,
    tone: 'success',
    updated: 'Nov 2026',
    popular: false,
    action: { to: PATHS.OFFICER_REPORTS, label: 'Open financial reports' },
    related: ['how-forecasts-work'],
    sections: [
      {
        id: 'make',
        title: 'Make a report',
        blocks: [
          {
            list: [
              'In Financial reports, click Generate report.',
              'Pick Monthly, Quarterly or Department (a date range for one department), the period and the department.',
              'Choose what to include, check the “will be included” line, and Generate.',
            ],
            ordered: true,
          },
          {
            p: 'The figures are frozen when the report is made: later approvals don’t change it. A monthly report for all departments is also made automatically on the 1st of every month.',
          },
        ],
      },
      {
        id: 'summary',
        title: 'The AI summary',
        blocks: [
          {
            p: 'The summary is written by OpenAI in the background (about 20 seconds) and appears by itself. Only totals, counts and department / category names are sent, never payees, people or descriptions. Always check the figures before sharing.',
          },
          {
            p: 'If OpenAI isn’t set up on the server, or this month’s spend cap is reached, the report is complete without a summary and says why.',
          },
        ],
      },
      {
        id: 'download',
        title: 'Downloads',
        blocks: [{ p: 'Every report downloads as a PDF or an Excel file. Downloads are recorded in the audit log.' }],
      },
    ],
  },
]

export const officerGuideBySlug = (slug) => OFFICER_GUIDES.find((g) => g.slug === slug)
export const officerGuideLink = (slug) => `${PATHS.OFFICER_HELP}/${slug}`
export const officerGuideTitle = (slug) => officerGuideBySlug(slug)?.title

/** "Review rules at a glance" (Framer ylRPv8gjJ side card), from the live rules. */
export function reviewRulesAtAGlance(rules) {
  return [
    `${threshold(rules)} or more → needs Supervisor approval`,
    flaggedGoesUp(rules) ? 'Flagged → always goes to Level 2' : 'Flagged → no extra step (setting off)',
    'Return needs what to fix + remarks',
    'Reject needs a reason + remarks',
    `Review within ${sla(rules)} (warning only)`,
  ]
}
