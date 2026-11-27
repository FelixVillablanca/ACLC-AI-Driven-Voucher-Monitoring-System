import { PATHS, ROLES } from '@/lib/constants'
import { guideBySlug, guideLink, guideTitle } from './guides'
import {
  OFFICER_CATEGORIES,
  OFFICER_GUIDES,
  officerGuideBySlug,
  officerGuideLink,
  officerGuideTitle,
  reviewRulesAtAGlance,
} from './officerGuides'
import {
  level2RulesAtAGlance,
  SUPERVISOR_CATEGORIES,
  SUPERVISOR_GUIDES,
  supervisorGuideBySlug,
  supervisorGuideLink,
  supervisorGuideTitle,
} from './supervisorGuides'

/**
 * Which guides a signed-in person reads (2026-11-27): the clerk's set (guides.js), the Accounting Officer's
 * (officerGuides.js) or the Supervisor / Manager's (supervisorGuides.js). The help center, the article page and Contact
 * support use this, so one page serves every role.
 */
const CLERK = { home: PATHS.CLERK_HELP, bySlug: guideBySlug, link: guideLink, title: guideTitle, categoryLabel: (c) => c }

const OFFICER = {
  home: PATHS.OFFICER_HELP,
  bySlug: officerGuideBySlug,
  link: officerGuideLink,
  title: officerGuideTitle,
  categoryLabel: (c) => OFFICER_CATEGORIES.find((x) => x.key === c)?.label ?? c,
  // the help center (Framer ylRPv8gjJ)
  categories: OFFICER_CATEGORIES,
  guides: OFFICER_GUIDES,
  subtitle: 'Guides for Level 1 review, budgets, forecasts and reports',
  searchHint: 'Search guides, e.g. “return a voucher” or “budget alert”',
  rulesTitle: 'Review rules at a glance',
  rulesAtAGlance: reviewRulesAtAGlance,
}

const SUPERVISOR = {
  home: PATHS.SUPERVISOR_HELP,
  bySlug: supervisorGuideBySlug,
  link: supervisorGuideLink,
  title: supervisorGuideTitle,
  categoryLabel: (c) => SUPERVISOR_CATEGORIES.find((x) => x.key === c)?.label ?? c,
  // the help center (Framer cR3NPU8IK)
  categories: SUPERVISOR_CATEGORIES,
  guides: SUPERVISOR_GUIDES,
  subtitle: 'Guides for Level 2 approval, oversight and reporting',
  searchHint: 'Search guides, e.g. “approve a flagged voucher” or “approve a top-up”',
  rulesTitle: 'Level 2 rules at a glance',
  rulesAtAGlance: level2RulesAtAGlance,
}

export const libraryFor = (role) => (role === ROLES.OFFICER ? OFFICER : role === ROLES.SUPERVISOR ? SUPERVISOR : CLERK)
