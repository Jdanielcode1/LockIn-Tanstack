import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getTempUser, type TempUser } from '../utils/tempUser'
import { UserSetupModal } from './UserSetupModal'

interface UserContextType {
  user: TempUser | null
  setUser: (user: TempUser | null) => void
  refreshUser: () => void
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

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<TempUser | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  const refreshUser = () => {
    const currentUser = getTempUser()
    setUser(currentUser)
    if (!currentUser && !isChecking) {
      setShowSetup(true)
    }
  }

  useEffect(() => {
    // Check for existing user on mount
    const currentUser = getTempUser()
    setUser(currentUser)
    setIsChecking(false)
    
    if (!currentUser) {
      setShowSetup(true)
    }
  }, [])

  const handleSetupComplete = () => {
    setShowSetup(false)
    refreshUser()
  }

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p className="text-[#8b949e]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <UserContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
      {showSetup && <UserSetupModal onComplete={handleSetupComplete} />}
    </UserContext.Provider>
  )
}

