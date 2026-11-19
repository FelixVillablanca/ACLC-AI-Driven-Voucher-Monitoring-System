import { apiClient, BACKGROUND } from '@/lib/apiClient'

/**
 * The signed-in user's notifications (bell panel). Only this file talks to the API.
 *   tab: 'all' | 'unread' | 'security'
 * Returns { items, unreadCount, nextCursor }.
 */
export async function listNotifications({ tab = 'all', cursor } = {}) {
  const params = { per_page: 20 }
  if (tab === 'unread') params['filter[unread]'] = 1
  if (tab === 'security') params['filter[category]'] = 'security'
  if (cursor) params.cursor = cursor

  const { data } = await apiClient.get('/notifications', { params })
  return { items: data.data, unreadCount: data.meta.unread_count, nextCursor: data.meta.next_cursor }
}

/** `background: true` = asked by the once-a-minute timer, not by a click (see BACKGROUND). */
export async function getUnreadCount({ background = false } = {}) {
  const { data } = await apiClient.get('/notifications/unread-count', background ? BACKGROUND : undefined)
  return data.data.unread_count
}

export async function markNotificationRead(id) {
  await apiClient.post(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead() {
  await apiClient.post('/notifications/read-all')
}
