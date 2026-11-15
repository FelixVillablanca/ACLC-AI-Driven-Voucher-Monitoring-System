import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * WHICH company the user is currently working in.
 * The API client sends `activeCompanyId` as the X-Company-ID header on every
 * request, and the backend only shows that company's data.
 *
 * `persist` remembers the choice in the browser, so a page refresh keeps it.
 */
export const useCompanyStore = create(
  persist(
    (set) => ({
      activeCompanyId: null,
      setActiveCompany: (companyId) => set({ activeCompanyId: companyId }),
      clear: () => set({ activeCompanyId: null }),
    }),
    { name: 'advms-active-company' },
  ),
)
