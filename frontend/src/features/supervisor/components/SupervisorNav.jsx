import { useLocation } from 'react-router-dom'
import {
  CircleHelp,
  FileBarChart,
  History,
  LayoutDashboard,
  ListChecks,
  PieChart,
  ScrollText,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import SidebarNav from '@/components/layout/SidebarNav'
import { PATHS } from '@/lib/constants'
import { useSupervisorSummary } from '../hooks/useSupervisorSummary'

/**
 * The Supervisor / Manager's sidebar (Framer RRXP4iCfd, 2026-11-27). The Dashboard is the landing page (Framer
 * YKfX_oJ3a); Flagged opens its own page (Framer ESBUdF0jl); Budgets (adI8wBXHd) and Financial reports (AaD8UZ08p) show
 * what waits for your sign-off; Forecasts (wY0BB3HcK) and Audit trail (xqItzoFYK) are read-only; Help & guides
 * (cR3NPU8IK). Every item has a page since 2026-11-27 (code differs from the frame: "Flagged" not "AI-flagged",
 * "Forecasts" not "AI forecasts", counts are what waits for you).
 */
export default function SupervisorNav({ onNavigate }) {
  const { data } = useSupervisorSummary()
  const { pathname } = useLocation()

  const groups = [
    { items: [{ to: PATHS.SUPERVISOR, label: 'Dashboard', icon: LayoutDashboard, active: pathname === PATHS.SUPERVISOR }] },
    {
      section: 'Approvals',
      items: [
        {
          to: PATHS.SUPERVISOR_QUEUE,
          label: 'Approval queue',
          icon: ListChecks,
          count: data?.queue.total,
          active: pathname === PATHS.SUPERVISOR_QUEUE || pathname.startsWith(`${PATHS.SUPERVISOR_VOUCHERS}/`),
        },
        {
          to: PATHS.SUPERVISOR_FLAGGED,
          label: 'Flagged',
          icon: TriangleAlert,
          count: data?.queue.ai_flagged,
          tone: 'danger',
          active: pathname === PATHS.SUPERVISOR_FLAGGED || pathname.startsWith(`${PATHS.SUPERVISOR_FLAGGED}/`),
        },
        { to: PATHS.SUPERVISOR_HISTORY, label: 'Decision history', icon: History, active: pathname === PATHS.SUPERVISOR_HISTORY },
      ],
    },
    {
      section: 'Oversight',
      items: [
        {
          to: PATHS.SUPERVISOR_BUDGETS,
          label: 'Budgets',
          icon: PieChart,
          // Accounting's budget changes waiting for a Supervisor's sign-off (Framer adI8wBXHd)
          count: data?.budget_requests ? `${data.budget_requests} waiting` : null,
          tone: 'warn',
          active: pathname === PATHS.SUPERVISOR_BUDGETS,
        },
        { to: PATHS.SUPERVISOR_FORECASTS, label: 'Forecasts', icon: TrendingUp, active: pathname === PATHS.SUPERVISOR_FORECASTS },
        { to: PATHS.SUPERVISOR_AUDIT, label: 'Audit trail', icon: ScrollText, active: pathname === PATHS.SUPERVISOR_AUDIT },
      ],
    },
    {
      section: 'Reports',
      items: [
        {
          to: PATHS.SUPERVISOR_REPORTS,
          label: 'Financial reports',
          icon: FileBarChart,
          count: data?.reports_to_sign ? `${data.reports_to_sign} to sign` : null,
          tone: 'warn',
          active: pathname === PATHS.SUPERVISOR_REPORTS || pathname.startsWith(`${PATHS.SUPERVISOR_REPORTS}/`),
        },
        {
          to: PATHS.SUPERVISOR_HELP,
          label: 'Help & guides',
          icon: CircleHelp,
          active: pathname === PATHS.SUPERVISOR_HELP || pathname.startsWith(`${PATHS.SUPERVISOR_HELP}/`),
        },
      ],
    },
  ]

  return <SidebarNav label="Supervisor / Manager" groups={groups} onNavigate={onNavigate} />
}
