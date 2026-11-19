import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api'

/**
 * Everything the panel needs: the list for the chosen tab, plus
 * "mark one / all as read". `onCountChange` keeps the bell's number in sync.
 *
 * OPTIMISTIC UPDATE: when you mark something as read, the screen changes
 * IMMEDIATELY, before the server answers. If the server then fails, we undo
 * the change and show an error. It feels instant, and nothing is ever lost.
 */
export function useNotificationList(tab, onCountChange) {
  const [state, setState] = useState({ status: 'loading', items: [], error: null })
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(
    () =>
      listNotifications({ tab })
        .then(({ items, unreadCount }) => {
          setState({ status: 'success', items, error: null })
          onCountChange(unreadCount)
        })
        .catch((error) => setState({ status: 'error', items: [], error })),
    [tab, onCountChange],
  )

  useEffect(() => {
    load()
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading', items: [], error: null })
    load()
  }, [load])

  const setRead = (ids, isRead) =>
    setState((s) => ({ ...s, items: s.items.map((n) => (ids.includes(n.id) ? { ...n, is_read: isRead } : n)) }))

  const markRead = async (item) => {
    if (item.is_read) return
    setRead([item.id], true)
    onCountChange((c) => Math.max(0, c - 1))
    try {
      await markNotificationRead(item.id)
    } catch (error) {
      setRead([item.id], false)
      onCountChange((c) => c + 1)
      toast.error(`Couldn't mark it as read: ${error.message}`)
    }
  }

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setState((s) => ({ ...s, items: s.items.map((n) => ({ ...n, is_read: true })) }))
      onCountChange(0)
    } catch (error) {
      toast.error(`Couldn't mark all as read: ${error.message}`)
    } finally {
      setMarkingAll(false)
    }
  }

  return { ...state, retry, markRead, markAllRead, markingAll }
}
