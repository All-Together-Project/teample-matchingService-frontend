import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { supabase } from '@/api/client'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string) => void
  updateUser: (user: Partial<User>) => void
  logout: () => Promise<void>
  hydrate: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),

      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null, accessToken: null, isAuthenticated: false })
      },

      hydrate: async () => {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          set({ user: null, accessToken: null, isAuthenticated: false })
          return
        }
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single()
        if (profile) {
          set({
            user: profile as User,
            accessToken: data.session.access_token,
            isAuthenticated: true,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
)

// Supabase 세션 변경(만료/갱신) 감지 → store 동기화
supabase.auth.onAuthStateChange((_event, session) => {
  const state = useAuthStore.getState()
  if (!session) {
    if (state.isAuthenticated) {
      useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    }
    return
  }
  if (state.user) {
    useAuthStore.setState({ accessToken: session.access_token, isAuthenticated: true })
  }
})
