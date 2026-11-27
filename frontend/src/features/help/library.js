import { PATHS, ROLES } from '@/lib/constants'
import { guideBySlug, guideLink, guideTitle } from './guides'
import { OFFICER_CATEGORIES, officerGuideBySlug, officerGuideLink, officerGuideTitle } from './officerGuides'

/**
 * Which guides a signed-in person reads (2026-11-27): the clerk's set (guides.js) or the Accounting Officer's
 * (officerGuides.js). The article page and Contact support use this, so one page serves both roles.
 */
const CLERK = { home: PATHS.CLERK_HELP, bySlug: guideBySlug, link: guideLink, title: guideTitle, categoryLabel: (c) => c }
const OFFICER = {
  home: PATHS.OFFICER_HELP,
  bySlug: officerGuideBySlug,
  link: officerGuideLink,
  title: officerGuideTitle,
  categoryLabel: (c) => OFFICER_CATEGORIES.find((x) => x.key === c)?.label ?? c,
}

export const libraryFor = (role) => (role === ROLES.OFFICER ? OFFICER : CLERK)
