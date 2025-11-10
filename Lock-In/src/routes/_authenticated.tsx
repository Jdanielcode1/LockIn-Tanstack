import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AuthModal } from '../components/auth/AuthModal'
import { ProfileSetupModal } from '../components/auth/ProfileSetupModal'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  // Use Better Auth session hook to get auth state
  const { data: session, isPending: authLoading } = authClient.useSession()

  // Query for user data
  const user = useQuery(api.users.getCurrentUser, {})

  // DEBUG: Log the current state
  console.log('[_authenticated] Current state:', {
    authLoading,
    hasSession: !!session?.user,
    user,
    hasUsername: user?.username,
    hasDisplayName: user?.displayName,
  })

  // If auth provider is still initializing, show loading
  if (authLoading) {
    console.log('[_authenticated] Auth provider initializing')
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p className="text-[#8b949e]">Authenticating...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, show auth modal
  if (!session?.user) {
    console.log('[_authenticated] Not authenticated, showing AuthModal')
    return <AuthModal />
  }

  // User is authenticated, wait for user data to load
  if (user === undefined) {
    console.log('[_authenticated] Authenticated, waiting for user data')
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <p className="text-[#8b949e]">Loading user data...</p>
        </div>
      </div>
    )
  }

  // If user data loaded, check if profile setup is needed
  if (user) {
    const needsProfileSetup = !user.username || !user.displayName

    if (needsProfileSetup) {
      console.log('[_authenticated] Profile setup needed, showing ProfileSetupModal')
      return <ProfileSetupModal />
    }

    console.log('[_authenticated] User authenticated and profile complete, showing app')
    return <Outlet />
  }

  // Fallback - shouldn't reach here, but show loading just in case
  console.log('[_authenticated] Unexpected state, showing loading')
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-6xl mb-4">⏳</div>
        <p className="text-[#8b949e]">Loading...</p>
      </div>
    </div>
  )
}
