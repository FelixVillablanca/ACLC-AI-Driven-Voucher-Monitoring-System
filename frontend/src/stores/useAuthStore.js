import { create } from 'zustand'

/**
 * WHO is logged in (global "client state").
 * status:
 *   'unknown'        still checking (show a loading screen)
 *   'authenticated'  logged in, `user` is filled
 *   'guest'          not logged in
 *
 * Phase 1 will check the session with GET /auth/me on app start.
 * Until then everyone starts as a guest.
 */
export const useAuthStore = create((set) => ({
  user: null,
  status: 'guest',

  setUser: (user) => set({ user, status: 'authenticated' }),
  clear: () => set({ user: null, status: 'guest' }),
}))
