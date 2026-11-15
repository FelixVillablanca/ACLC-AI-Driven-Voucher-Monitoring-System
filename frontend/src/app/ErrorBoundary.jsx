import { Component } from 'react'
import ErrorState from '@/components/common/ErrorState'

/**
 * SAFETY NET: if any component crashes while drawing the screen, React would
 * normally show a blank white page. This catches the crash and shows a
 * friendly message with a "Try again" button instead.
 * (React only supports this as a class component.)
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Phase 8: send to Sentry. For now, show it in the browser console for debugging.
    console.error('UI crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <ErrorState
            title="This page stopped working"
            message="An unexpected problem happened. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
          />
        </div>
      )
    }
    return this.props.children
  }
}
