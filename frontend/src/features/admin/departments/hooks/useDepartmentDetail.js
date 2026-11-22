import { useCallback, useEffect, useState } from 'react'
import { getDepartment, listDepartmentMembers } from '../api'
import { DEPARTMENTS_CHANGED_EVENT } from '../utils'

/**
 * The side panel: the department + its people (20 a page, "Show more" adds the next page).
 *   { status, department, error, reload, members: { status, items, total, headId, hasMore, loadMore, retry, error } }
 * Answers are saved with the id they're for, so a quick switch between departments never mixes them up.
 * Refreshes quietly after an edit / deactivate.
 */
export function useDepartmentDetail(id) {
  const [state, setState] = useState({ key: null, status: 'loading', department: null, error: null })
  const [members, setMembers] = useState({ key: null, status: 'loading', items: [], meta: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const key = `${id}|${attempt}`

  const loadMembers = useCallback(
    (page = 1) =>
      listDepartmentMembers(id, page)
        .then(({ items, meta }) =>
          setMembers((prev) => ({ key, status: 'success', items: page === 1 ? items : [...prev.items, ...items], meta, error: null })),
        )
        .catch((error) => setMembers((prev) => ({ ...prev, key, status: page === 1 ? 'error' : prev.status, error }))),
    [id, key],
  )

  useEffect(() => {
    if (!id) return undefined
    let alive = true
    const load = () => {
      getDepartment(id)
        .then((department) => alive && setState({ key, status: 'success', department, error: null }))
        .catch((error) => alive && setState({ key, status: 'error', department: null, error }))
      loadMembers(1)
    }
    load()
    window.addEventListener(DEPARTMENTS_CHANGED_EVENT, load)
    return () => {
      alive = false
      window.removeEventListener(DEPARTMENTS_CHANGED_EVENT, load)
    }
  }, [id, key, loadMembers])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  const current = state.key === key
  const membersCurrent = members.key === key
  const meta = membersCurrent ? members.meta : null

  return {
    status: current ? state.status : 'loading',
    department: current ? state.department : null,
    error: current ? state.error : null,
    reload,
    members: {
      status: membersCurrent ? members.status : 'loading',
      items: membersCurrent ? members.items : [],
      error: membersCurrent ? members.error : null,
      total: meta?.total ?? 0,
      headId: meta?.head_user_id ?? null,
      hasMore: meta ? meta.current_page < meta.last_page : false,
      loadMore: () => meta && loadMembers(meta.current_page + 1),
      retry: () => loadMembers(1),
    },
  }
}
