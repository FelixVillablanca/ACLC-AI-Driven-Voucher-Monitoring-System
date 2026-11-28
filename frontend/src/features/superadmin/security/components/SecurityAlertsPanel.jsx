import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SECURITY_ALERT_PARAM, SECURITY_PANEL_PARAM, SECURITY_PANEL_VALUE } from '../utils'
import AlertDetailView from './AlertDetailView'
import AlertsListView from './AlertsListView'

/**
 * Security alerts side panel (Framer mQcXDCyDZ, 440px) and the Alert detail panel
 * (Framer SCoT_cu7B, 480px), sliding in from the right over a dark scrim.
 *
 * The ADDRESS decides what's open, so Back works and a link can open it from anywhere:
 *   ?panel=security-alerts            the list
 *   ?panel=security-alerts&alert=12   one alert ("← All alerts" goes back to the list)
 */
export default function SecurityAlertsPanel() {
  const [params, setParams] = useSearchParams()
  const open = params.get(SECURITY_PANEL_PARAM) === SECURITY_PANEL_VALUE
  const alertId = Number(params.get(SECURITY_ALERT_PARAM)) || null

  const close = useCallback(() => {
    setParams(
      (p) => {
        p.delete(SECURITY_PANEL_PARAM)
        p.delete(SECURITY_ALERT_PARAM)
        return p
      },
      { replace: true },
    )
  }, [setParams])

  const showAlert = useCallback(
    (id) =>
      setParams((p) => {
        p.set(SECURITY_PANEL_PARAM, SECURITY_PANEL_VALUE)
        if (id) p.set(SECURITY_ALERT_PARAM, String(id))
        else p.delete(SECURITY_ALERT_PARAM)
        return p
      }),
    [setParams],
  )

  return (
    <AnimatePresence>{open && <Drawer key="security-drawer" alertId={alertId} onClose={close} onShowAlert={showAlert} />}</AnimatePresence>
  )
}

function Drawer({ alertId, onClose, onShowAlert }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Move keyboard focus into the panel when it opens or switches view
  useEffect(() => {
    panelRef.current?.focus()
  }, [alertId])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 bg-foreground/45"
    >
      <motion.aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={alertId ? 'Security alert details' : 'Security alerts'}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l bg-card text-foreground shadow-2xl outline-none',
          alertId ? 'sm:w-[480px]' : 'sm:w-[440px]',
        )}
      >
        {alertId ? (
          <AlertDetailView key={alertId} alertId={alertId} onBack={() => onShowAlert(null)} onClose={onClose} />
        ) : (
          <AlertsListView onOpenAlert={onShowAlert} onClose={onClose} />
        )}
      </motion.aside>
    </motion.div>
  )
}
