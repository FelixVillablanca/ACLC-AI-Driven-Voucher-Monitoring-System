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
 * YKfX_oJ3a); Flagged opens its own page (Framer ESBUdF0jl). Budgets, Forecasts, Audit trail, Financial reports and Help & guides
 * have no Supervisor page yet, so they show "Soon" (code differs from the frame: "Flagged" not "AI-flagged",
 * "Forecasts" not "AI forecasts").
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
        { label: 'Budgets', icon: PieChart },
        { label: 'Forecasts', icon: TrendingUp },
        { label: 'Audit trail', icon: ScrollText },
      ],
    },
    {
      section: 'Reports',
      items: [
        { label: 'Financial reports', icon: FileBarChart },
        { label: 'Help & guides', icon: CircleHelp },
      ],
    },
  ]

  return <SidebarNav label="Supervisor / Manager" groups={groups} onNavigate={onNavigate} />
}
