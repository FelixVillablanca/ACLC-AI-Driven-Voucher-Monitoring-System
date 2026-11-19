import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, UserPlus, X } from 'lucide-react'
import ErrorState from '@/components/common/ErrorState'
import EmptyState from '@/components/common/EmptyState'
import { useCompanyOptions } from '../hooks/useCompanyOptions'
import { useNextEmployeeId } from '../hooks/useNextEmployeeId'
import { USERS_CHANGED_EVENT } from '../utils'
import CreateUserForm from './CreateUserForm'
import UserCreatedPanel from './UserCreatedPanel'

/**
 * The "Create user" modal (Framer lmhV2DJV1).
 *
 * It opens whenever the address ends with ?create=user, so ANY button can open it
 * (top bar "+ Add user", Quick actions "Create user"), and the browser's Back button
 * closes it. Closing just removes ?create=user again.
 */
export default function CreateUserModal() {
  const [params, setParams] = useSearchParams()
  const open = params.get('create') === 'user'

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
  const { status, companies, error, retry } = useCompanyOptions()
  const employeeIdPreview = useNextEmployeeId()
  const [result, setResult] = useState(null) // set after a successful create
  const [formKey, setFormKey] = useState(0) // changing it gives a fresh, empty form
  const dirtyRef = useRef(false)

  // Esc closes (the form keeps nothing secret, but we don't close on a stray backdrop click if typed in)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const rememberDirty = useCallback((dirty) => {
    dirtyRef.current = dirty
  }, [])

  const onBackdrop = (e) => {
    if (e.target === e.currentTarget && !dirtyRef.current) onClose()
  }

  const onCreated = (created, values) => {
    // Keep the password from the form: the server never sends it back
    setResult({ user: created, password: values.password })
    window.dispatchEvent(new CustomEvent(USERS_CHANGED_EVENT))
  }

  const createAnother = () => {
    setResult(null)
    dirtyRef.current = false
    setFormKey((k) => k + 1) // fresh empty form with a NEW password
    employeeIdPreview.reload() // the next number moved on
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={onBackdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="flex max-h-[calc(100dvh-2rem)] w-[760px] max-w-full flex-col overflow-hidden rounded-[14px] border bg-card text-foreground shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3.5 border-b px-6 pt-5 pb-[18px]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
            <UserPlus className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="create-user-title" className="text-page-title">
              Create user
            </h2>
            <p className="text-body text-muted-foreground">Add a new account, assign a role, and grant company access.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body: loading / error / no companies / form / success */}
        {status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 p-16">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-caption">Loading companies and departments…</span>
          </div>
        )}

        {status === 'error' && (
          <ErrorState title="Couldn't load the form" message={error.message} requestId={error.requestId} onRetry={retry} />
        )}

        {status === 'success' && !companies.some((c) => c.is_active) && (
          <EmptyState
            title="No active companies yet"
            description="Every user belongs to a company. Add a company first, then create users."
          />
        )}

        {status === 'success' && companies.some((c) => c.is_active) && !result && (
          <CreateUserForm
            key={formKey}
            companies={companies}
            employeeIdPreview={employeeIdPreview}
            onCancel={onClose}
            onCreated={onCreated}
            onDirtyChange={rememberDirty}
          />
        )}

        {result && (
          <UserCreatedPanel
            result={result}
            onCreateAnother={createAnother}
            onDone={onClose}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
