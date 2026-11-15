import { Toaster } from 'react-hot-toast'
import ErrorBoundary from '@/app/ErrorBoundary'

/**
 * Everything that wraps the whole app goes here (safety net, toasts, and
 * later the data-fetching provider if approved).
 * Toasts = the small pop-up messages: toast.success('Saved!'), toast.error(err.message)
 */
export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontSize: '14px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          },
          success: { iconTheme: { primary: 'var(--status-success)', secondary: '#fff' } },
          error: { iconTheme: { primary: 'var(--status-danger)', secondary: '#fff' } },
        }}
      />
    </ErrorBoundary>
  )
}
