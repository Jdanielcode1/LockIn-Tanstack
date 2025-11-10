import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { authClient } from '../lib/auth-client'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface User {
  _id: Id<"users">
  _creationTime: number
  username?: string
  displayName?: string
  email?: string
  name?: string
  bio?: string
  avatarKey?: string
  location?: string
  createdAt?: number
}

interface UserContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}

interface UserProviderProps {
  children: ReactNode
}

/**
 * UserProvider - Supplementary user context provider
 *
 * Note: This provider does NOT handle auth gating or profile setup.
 * That's now handled by the _authenticated layout route.
 * This provider simply makes user data available to components via useUser().
 */
export function UserProvider({ children }: UserProviderProps) {
  // Use native Convex useQuery for reactive auth state
  const user = useQuery(api.users.getCurrentUser, {})

  const isAuthenticated = user !== null && user !== undefined
  const isLoading = user === undefined

  const signOut = async () => {
    await authClient.signOut()
  }

  return (
    <UserContext.Provider value={{ user: user || null, isAuthenticated, isLoading, signOut }}>
      {children}
    </UserContext.Provider>
  )
}

