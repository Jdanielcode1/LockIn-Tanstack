import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'

export function ProfileSetupModal() {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const setupProfile = useConvexMutation(api.users.setupProfile)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await setupProfile({
        username,
        displayName,
      })
      // Profile setup complete, UserProvider will detect the change and show the app
    } catch (err: any) {
      setError(err.message || 'Failed to set up profile')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 max-w-md w-full">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Complete Your Profile</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[#c9d1d9] mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white focus:border-[#58a6ff] focus:outline-none"
              placeholder="your_username"
              required
              pattern="[a-zA-Z0-9_]{3,20}"
              title="3-20 characters, letters, numbers, and underscores only"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-[#c9d1d9] mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white focus:border-[#58a6ff] focus:outline-none"
              placeholder="Your Name"
              required
              maxLength={50}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-medium py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}
