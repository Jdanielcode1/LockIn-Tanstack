import { useState } from 'react'
import { authClient } from '../../lib/auth-client'
import { api } from '../../../convex/_generated/api'
import { useConvexMutation } from '@convex-dev/react-query'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const createUserRecord = useConvexMutation(api.users.setupProfile)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    console.log('[SignUpForm] Starting signup for:', email)

    try {
      // Sign up with Better Auth
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      })

      console.log('[SignUpForm] Signup result:', result)

      if (result.error) {
        setError(result.error.message || 'Failed to sign up')
        return
      }

      // Better Auth creates the user in its own tables
      // The Lock-In users table will be created when the user sets up their profile
      // Signup successful - auth state will update automatically
    } catch (err: any) {
      console.error('[SignUpForm] Signup error:', err)
      setError(err.message || 'Failed to sign up')
    } finally {
      setLoading(false)
      console.log('[SignUpForm] Loading state reset')
    }
  }

  return (
    <form onSubmit={handleSignUp} className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-4">Create Account</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm text-[#c9d1d9] mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white focus:border-[#58a6ff] focus:outline-none"
          placeholder="Your Name"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-[#c9d1d9] mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white focus:border-[#58a6ff] focus:outline-none"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-[#c9d1d9] mb-1">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white focus:border-[#58a6ff] focus:outline-none"
          placeholder="••••••••"
          required
          minLength={8}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-medium py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  )
}
