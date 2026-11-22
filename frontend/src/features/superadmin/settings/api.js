import { apiClient } from '@/lib/apiClient'

/**
 * The Global settings page (Framer tsrXCiWWw).
 * Returns { values: { [key]: value }, context: { companies, ml_service, admins, backups, last_saved, … } }
 */
export async function getGlobalSettings() {
  const { data } = await apiClient.get('/superadmin/settings')
  return data.data
}

/**
 * Save (G3). changes = [{ key, value, was }] where `was` is the value the page loaded.
 * Returns { values, lastSaved, changed, adminsNotified, twoFactorRequired }.
 * 422 = wrong password / missing reason / bad value; 409 SETTINGS_CHANGED = someone else saved first.
 */
export async function saveGlobalSettings({ changes, reason, notifyAdmins, password }) {
  const { data } = await apiClient.put('/superadmin/settings', {
    changes,
    reason,
    notify_admins: notifyAdmins,
    password,
  })
  return {
    values: data.data.values,
    lastSaved: data.data.last_saved,
    changed: data.meta.changed,
    adminsNotified: data.meta.admins_notified,
    twoFactorRequired: data.meta.two_factor_required,
  }
}

/** Change history (G1), newest first, 10 a page. group: 'approval' | 'ai' | 'openai' | 'security' | undefined */
export async function listSettingsHistory({ group, page = 1 } = {}) {
  const { data } = await apiClient.get('/superadmin/settings/history', {
    params: { group: group || undefined, page },
  })
  return { items: data.data, meta: data.meta }
}
