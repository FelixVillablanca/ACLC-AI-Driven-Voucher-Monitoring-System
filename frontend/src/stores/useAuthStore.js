import { create } from 'zustand'

/**
 * WHO is logged in (global "client state").
 * status:
 *   'unknown'        still asking the server "am I logged in?" (show a loading screen)
 *   'authenticated'  logged in, `user` is filled
 *   'guest'          not logged in
 *   'error'          couldn't ask the server (offline / server down), `error` explains why
 *
 * On app start, features/auth checks the session with GET /auth/me.
 */
export const useAuthStore = create((set) => ({
  user: null,
  status: 'unknown',
  error: null,

  setUser: (user) => set({ user, status: 'authenticated', error: null }),
  setChecking: () => set({ status: 'unknown', error: null }),
  setError: (error) => set({ user: null, status: 'error', error }),
  clear: () => set({ user: null, status: 'guest', error: null }),
}))
