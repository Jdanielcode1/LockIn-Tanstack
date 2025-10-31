import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { setTempUser } from '../utils/tempUser'

interface UserSetupModalProps {
  onComplete: () => void
}

export function UserSetupModal({ onComplete }: UserSetupModalProps) {
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const createUser = useMutation(api.users.createUser)

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) return 'Username must be at least 3 characters'
    if (value.length > 20) return 'Username must be less than 20 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Username can only contain letters, numbers, and underscores'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate username
    const usernameError = validateUsername(username)
    if (usernameError) {
      setError(usernameError)
      return
    }

    // Validate display name
    if (!displayName.trim() || displayName.trim().length < 1) {
      setError('Display name is required')
      return
    }

    if (displayName.trim().length > 50) {
      setError('Display name must be less than 50 characters')
      return
    }

    setCreating(true)

    try {
      const result = await createUser({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
      })

      // Store in localStorage
      setTempUser({
        userId: result.userId,
        username: username.trim(),
      })

      // Complete setup
      onComplete()
    } catch (error: any) {
      console.error('Error creating user:', error)
      setError(error.message || 'Failed to create account. Please try again.')
      setCreating(false)
    }
  }

  if (step === 'welcome') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-[#161b22] rounded-lg max-w-md w-full mx-4 border border-[#30363d] p-8 text-center">
          <div className="text-6xl mb-4">👋</div>
          <h1 className="text-3xl font-bold text-[#c9d1d9] mb-4">
            Welcome to Lock-In
          </h1>
          <p className="text-[#8b949e] mb-6">
            Create your profile to start tracking your progress and sharing your work with the community.
          </p>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 text-left">
              <div className="text-2xl">📹</div>
              <div>
                <h3 className="text-[#c9d1d9] font-semibold">Upload Timelapses</h3>
                <p className="text-sm text-[#8b949e]">Share your work progress with videos</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 text-left">
              <div className="text-2xl">🎯</div>
              <div>
                <h3 className="text-[#c9d1d9] font-semibold">Track Projects</h3>
                <p className="text-sm text-[#8b949e]">Set goals and monitor your hours</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 text-left">
              <div className="text-2xl">🌟</div>
              <div>
                <h3 className="text-[#c9d1d9] font-semibold">Build Your Profile</h3>
                <p className="text-sm text-[#8b949e]">Showcase your dedication and growth</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep('setup')}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-3 px-4 rounded-md transition font-semibold text-lg"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-[#161b22] rounded-lg max-w-md w-full mx-4 my-8 border border-[#30363d]">
        {/* Header */}
        <div className="border-b border-[#30363d] px-6 py-4">
          <h2 className="text-xl font-semibold text-[#c9d1d9]">Create Your Profile</h2>
          <p className="text-sm text-[#8b949e] mt-1">Choose your username and set up your profile</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-[#f85149]/10 border border-[#f85149]/50 rounded-md p-3">
              <p className="text-sm text-[#f85149]">{error}</p>
            </div>
          )}

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Username <span className="text-[#f85149]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]">
                @
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase())
                  setError('')
                }}
                maxLength={20}
                required
                disabled={creating}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md pl-8 pr-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
                placeholder="username"
              />
            </div>
            <p className="text-xs text-[#8b949e] mt-1">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Display Name <span className="text-[#f85149]">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setError('')
              }}
              maxLength={50}
              required
              disabled={creating}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none disabled:opacity-50"
              placeholder="Your Name"
            />
            <p className="text-xs text-[#8b949e] mt-1">
              This is how others will see you • {displayName.length}/50 characters
            </p>
          </div>

          {/* Bio (Optional) */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Bio <span className="text-[#8b949e]">(Optional)</span>
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              disabled={creating}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none resize-none disabled:opacity-50"
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-[#8b949e] mt-1">
              {bio.length}/200 characters
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-2.5 px-4 rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <div className="animate-spin">⏳</div>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </div>

          {/* Info */}
          <div className="text-center">
            <p className="text-xs text-[#8b949e]">
              You can update your profile and add an avatar later
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

