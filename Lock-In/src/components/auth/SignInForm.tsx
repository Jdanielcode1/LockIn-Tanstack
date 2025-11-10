import { useState } from 'react'
import { authClient } from '../../lib/auth-client'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    console.log('[SignInForm] Starting signin for:', email)

    try {
      // Sign in with Better Auth
      const result = await authClient.signIn.email({
        email,
        password,
      })

      console.log('[SignInForm] Signin result:', result)

      if (result.error) {
        setError(result.error.message || 'Failed to sign in')
        return
      }

      // Sign in successful - auth state will update automatically
    } catch (err: any) {
      console.error('[SignInForm] Signin error:', err)
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
      console.log('[SignInForm] Loading state reset')
    }
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-4">Welcome Back</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded">
          {error}
        </div>
      )}

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
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-medium py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
