import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api'
import { NOTIFICATIONS_CHANGED_EVENT } from '../utils'

/**
 * The All notifications page: the list for one tab, 20 at a time ("Load more" uses the cursor the
 * server gives), mark one / all as read. Every change fires NOTIFICATIONS_CHANGED_EVENT so the bell's
 * number updates at once. Marking is optimistic (the screen changes first, and is undone if it fails).
 */
export function useNotificationsPage(tab) {
  const [state, setState] = useState({ tab: null, status: 'loading', items: [], unread: 0, next: null, error: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const key = `${tab}|${attempt}`

  useEffect(() => {
    let alive = true
    listNotifications({ tab })
      .then(
        ({ items, unreadCount, nextCursor }) =>
          alive && setState({ tab: key, status: 'success', items, unread: unreadCount, next: nextCursor, error: null }),
      )
      .catch((error) => alive && setState({ tab: key, status: 'error', items: [], unread: 0, next: null, error }))
    return () => {
      alive = false
    }
  }, [tab, key])

  const loadMore = async () => {
    if (!state.next) return
    setLoadingMore(true)
    try {
      const { items, unreadCount, nextCursor } = await listNotifications({ tab, cursor: state.next })
      setState((s) => ({ ...s, items: [...s.items, ...items], unread: unreadCount, next: nextCursor }))
    } catch (error) {
      toast.error(`Couldn't load more: ${error.message}`)
    } finally {
      setLoadingMore(false)
    }
  }

  const announce = () => window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))

  const markRead = async (item) => {
    if (item.is_read) return
    const flip = (isRead) =>
      setState((s) => ({
        ...s,
        unread: Math.max(0, s.unread + (isRead ? -1 : 1)),
        items: s.items.map((n) => (n.id === item.id ? { ...n, is_read: isRead } : n)),
      }))
    flip(true)
    try {
      await markNotificationRead(item.id)
      announce()
    } catch (error) {
      flip(false)
      toast.error(`Couldn't mark it as read: ${error.message}`)
    }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setState((s) => ({ ...s, unread: 0, items: s.items.map((n) => ({ ...n, is_read: true })) }))
      announce()
      toast.success('All notifications marked as read.')
    } catch (error) {
      toast.error(`Couldn't mark all as read: ${error.message}`)
    } finally {
      setMarkingAll(false)
    }
  }

  const current = state.tab === key
  return {
    status: current ? state.status : 'loading',
    items: current ? state.items : [],
    unread: current ? state.unread : 0,
    hasMore: current && Boolean(state.next),
    error: current ? state.error : null,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
    loadMore,
    loadingMore,
    markRead,
    markAllRead,
    markingAll,
  }
}
