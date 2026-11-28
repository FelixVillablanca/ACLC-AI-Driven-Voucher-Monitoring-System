import { useLocation } from 'react-router-dom'
import { CircleHelp, FilePen, FileText, LayoutDashboard, NotebookTabs, Plus, Undo2, Users } from 'lucide-react'
import { PATHS } from '@/lib/constants'
import SidebarNav from '@/components/layout/SidebarNav'
import { useClerkDashboard } from '../hooks/useClerkDashboard'

/**
 * The Accounting Clerk's sidebar menu (Framer LolF6YFo5). The counts are real (the dashboard data).
 * Drafts has its own page (/clerk/drafts, Framer Xfr2PEq2q), and so does Returned to me (/clerk/returned,
 * Framer xRM5FKjDQ). Help & guides opens the help center (/clerk/help, Framer V0J_GkScn).
 * Payees (/clerk/payees, Framer jbj8yIDz9). An item without a page would show greyed out with "Soon".
 */
export default function ClerkNav({ onNavigate }) {
  const { data } = useClerkDashboard()
  const { pathname } = useLocation()
  const counts = data?.counts
  const onList = pathname === PATHS.CLERK_VOUCHERS

  const groups = [
    { items: [{ to: PATHS.CLERK, label: 'Dashboard', icon: LayoutDashboard, active: pathname === PATHS.CLERK }] },
    {
      section: 'Vouchers',
      items: [
        { to: PATHS.CLERK_VOUCHER_NEW, label: 'Create voucher', icon: Plus, active: pathname === PATHS.CLERK_VOUCHER_NEW },
        {
          to: PATHS.CLERK_VOUCHERS,
          label: 'My vouchers',
          icon: FileText,
          count: counts?.all,
          // the list and a voucher's own pages
          active: onList || (pathname.startsWith(`${PATHS.CLERK_VOUCHERS}/`) && pathname !== PATHS.CLERK_VOUCHER_NEW),
        },
        {
          to: PATHS.CLERK_DRAFTS,
          label: 'Drafts',
          icon: FilePen,
          count: counts?.drafts,
          active: pathname === PATHS.CLERK_DRAFTS,
        },
        {
          to: PATHS.CLERK_RETURNED,
          label: 'Returned to me',
          icon: Undo2,
          count: counts?.returned,
          tone: 'warn',
          active: pathname === PATHS.CLERK_RETURNED,
        },
      ],
    },
    {
      section: 'Reference',
      items: [
        { to: PATHS.CLERK_PAYEES, label: 'Payees', icon: Users, active: pathname === PATHS.CLERK_PAYEES },
        { to: PATHS.CLERK_CHEQUES, label: 'Cheques', icon: NotebookTabs, active: pathname === PATHS.CLERK_CHEQUES },
        {
          to: PATHS.CLERK_HELP,
          label: 'Help & guides',
          icon: CircleHelp,
          // the help center, its guides, and the live approval guide (one of them)
          active: pathname === PATHS.CLERK_HELP || pathname.startsWith(`${PATHS.CLERK_HELP}/`) || pathname === PATHS.CLERK_APPROVAL_GUIDE,
        },
      ],
    },
  ]

  return <SidebarNav label="Accounting Clerk" groups={groups} onNavigate={onNavigate} />
}
