import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  const isMockMode = true // Temporary UI testing flag

  useEffect(() => {
    if (isMockMode) {
      setUser({ id: 'mock-user-1', email: 'tester@example.com', user_metadata: { full_name: 'Test Setup User' } })
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const register = async (email, password, fullName) => {
    if (isMockMode) {
      setUser({ id: 'mock-user-1', email, user_metadata: { full_name: fullName } })
      return { user: { email } }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return data
  }

  const login = async (email, password) => {
    if (isMockMode) {
      setUser({ id: 'mock-user-1', email, user_metadata: { full_name: 'Test Setup User' } })
      return { user: { email } }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const logout = async () => {
    if (isMockMode) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
