import { useLocation } from 'react-router-dom'
import {
  CircleHelp,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  NotebookTabs,
  PieChart,
  TrendingUp,
  TriangleAlert,
  UserCheck,
} from 'lucide-react'
import SidebarNav from '@/components/layout/SidebarNav'
import { PATHS } from '@/lib/constants'
import { useOfficerSummary } from '../hooks/useOfficerSummary'

/**
 * The Accounting Officer's sidebar (Framer vZeEe5_Hq). Dashboard is the landing page (Framer tfDekIe0N,
 * 2026-11-27); Flagged is its own page (/officer/flagged, Framer dtNDyUAUp, since 2026-11-27); Budgets
 * (/officer/budgets, Framer AwnFnuBYJ, since 2026-11-27) with "N alert(s)" = budgets over their alert %.
 * Forecasts (/officer/forecasts, Framer GWmqqOmd7) and Financial reports (/officer/reports, Framer ARxG8Aa6F), both
 * and Help & guides (/officer/help, Framer ylRPv8gjJ), all since 2026-11-27. Every item has a page now.
 */
export default function OfficerNav({ onNavigate }) {
  const { data } = useOfficerSummary()
  const { pathname } = useLocation()
  const onQueue = pathname === PATHS.OFFICER_QUEUE

  const groups = [
    { items: [{ to: PATHS.OFFICER, label: 'Dashboard', icon: LayoutDashboard, active: pathname === PATHS.OFFICER }] },
    {
      section: 'Review',
      items: [
        {
          to: PATHS.OFFICER_QUEUE,
          label: 'Review queue',
          icon: ListChecks,
          count: data?.queue.total,
          // the queue (every tab) and a voucher being reviewed
          active: onQueue || pathname.startsWith(`${PATHS.OFFICER_VOUCHERS}/`),
        },
        {
          to: PATHS.OFFICER_FLAGGED,
          label: 'Flagged',
          icon: TriangleAlert,
          count: data?.queue.ai_flagged,
          tone: 'danger',
          active: pathname === PATHS.OFFICER_FLAGGED || pathname.startsWith(`${PATHS.OFFICER_FLAGGED}/`),
        },
        { to: PATHS.OFFICER_REVIEWED, label: 'Reviewed by me', icon: UserCheck, active: pathname === PATHS.OFFICER_REVIEWED },
      ],
    },
    {
      section: 'Budget',
      items: [
        {
          to: PATHS.OFFICER_BUDGETS,
          label: 'Budgets',
          icon: PieChart,
          // Framer "1 alert": this fiscal year's budgets at or over their alert %
          count: data?.budget_alerts ? `${data.budget_alerts} ${data.budget_alerts === 1 ? 'alert' : 'alerts'}` : null,
          tone: 'danger',
          active: pathname === PATHS.OFFICER_BUDGETS || pathname.startsWith(`${PATHS.OFFICER_BUDGETS}/`),
        },
        {
          // "Forecasts", not "AI forecasts": a linear trend until the Phase 5 model (same rule as "Flagged")
          to: PATHS.OFFICER_FORECASTS,
          label: 'Forecasts',
          icon: TrendingUp,
          active: pathname === PATHS.OFFICER_FORECASTS || pathname.startsWith(`${PATHS.OFFICER_FORECASTS}/`),
        },
        { to: PATHS.OFFICER_CHEQUES, label: 'Cheques', icon: NotebookTabs, active: pathname === PATHS.OFFICER_CHEQUES },
      ],
    },
    {
      section: 'Reports',
      items: [
        {
          to: PATHS.OFFICER_REPORTS,
          label: 'Financial reports',
          icon: FileBarChart,
          active: pathname === PATHS.OFFICER_REPORTS || pathname.startsWith(`${PATHS.OFFICER_REPORTS}/`),
        },
        {
          to: PATHS.OFFICER_HELP,
          label: 'Help & guides',
          icon: CircleHelp,
          active: pathname === PATHS.OFFICER_HELP || pathname.startsWith(`${PATHS.OFFICER_HELP}/`),
        },
      ],
    },
  ]

  return <SidebarNav label="Accounting Officer" groups={groups} onNavigate={onNavigate} />
}
