import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import EmptyState from '@/components/common/EmptyState'
import ErrorState from '@/components/common/ErrorState'
import { useAdminFormDefaults } from '../hooks/useAdminFormDefaults'
import { ADMINS_CHANGED_EVENT } from '../utils'
import AddAdminForm from './AddAdminForm'
import AdminCreatedPanel from './AdminCreatedPanel'

/**
 * "Create admin account" modal (Framer TkIHF89oH, 640px; company + personal email added 2026-11-20).
 * Opens on ANY Super Admin page when the address has ?create=admin
 * ("+ Add admin" buttons), and Back / Esc / ✕ / Cancel close it.
 */
export default function AddAdminModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get('create') === 'admin'

  const close = useCallback(() => {
    setParams(
      (p) => {
        p.delete('create')
        return p
      },
      { replace: true },
    )
  }, [setParams])

  return <AnimatePresence>{open && <ModalWindow onClose={close} />}</AnimatePresence>
}

function ModalWindow({ onClose }) {
  const defaults = useAdminFormDefaults()
  const [result, setResult] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const dirtyRef = useRef(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rememberDirty = useCallback((dirty) => {
    dirtyRef.current = dirty
  }, [])

  // A click on the dark backdrop closes it, unless something was typed (so nothing is lost by accident)
  const onBackdrop = (e) => {
    if (e.target === e.currentTarget && !dirtyRef.current) onClose()
  }

  const onCreated = ({ admin, invitationSent }) => {
    setResult({ admin, invitationSent })
    if (invitationSent) toast.success(`${admin.full_name} was added. Invitation sent to ${admin.personal_email}`)
    else toast.error('The account was created, but the invitation email could not be sent.')
    window.dispatchEvent(new CustomEvent(ADMINS_CHANGED_EVENT))
  }

  const createAnother = () => {
    setResult(null)
    dirtyRef.current = false
    setFormKey((k) => k + 1) // fresh, empty form
    defaults.reload() // the next Employee ID and the Admin counts moved on
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 sm:items-start sm:pt-16"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex max-h-[calc(100dvh-2rem)] w-[640px] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl sm:max-h-[calc(100dvh-5rem)]"
      >
        <div className="flex items-start gap-3 border-b px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="create-admin-title" className="text-page-title">
              {result ? 'Admin account created' : 'Create admin account'}
            </h2>
            <p className="text-body text-muted-foreground">
              Admins set up companies, departments and users. Only Super Admins can create them.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {result && <AdminCreatedPanel result={result} onCreateAnother={createAnother} onDone={onClose} />}

        {!result && defaults.status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 p-16">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading companies…</span>
          </div>
        )}

        {!result && defaults.status === 'error' && (
          <ErrorState
            title="Couldn't load the form"
            message={defaults.error.message}
            requestId={defaults.error.requestId}
            onRetry={defaults.reload}
          />
        )}

        {!result && defaults.status === 'success' && defaults.companies.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No active companies yet"
            description="Every Admin runs one company. Create a company first (Companies tab), then add its Admin."
          />
        )}

        {!result && defaults.status === 'success' && defaults.companies.length > 0 && (
          <AddAdminForm
            key={formKey}
            defaults={defaults}
            onCancel={onClose}
            onCreated={onCreated}
            onDirtyChange={rememberDirty}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
