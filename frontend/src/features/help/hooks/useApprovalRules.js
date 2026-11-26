import { useEffect, useState } from 'react'
import { getApprovalRules } from '@/features/vouchers'

/**
 * The live approval rules (high-value threshold, AI-flagged → Supervisor, reviewing live?) for guides
 * and FAQ answers. null while loading or if it failed: the texts then fall back to general wording.
 */
export function useApprovalRules() {
  const [rules, setRules] = useState(null)
  useEffect(() => {
    let alive = true
    getApprovalRules()
      .then((r) => alive && setRules(r))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return rules
}
