import { useState } from 'react'
import { SignUpForm } from './SignUpForm'
import { SignInForm } from './SignInForm'

export function AuthModal() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6 w-full max-w-md">
        <div className="flex gap-2 mb-6 border-b border-[#21262d]">
          <button
            onClick={() => setMode('signIn')}
            className={`pb-2 px-1 ${
              mode === 'signIn'
                ? 'border-b-2 border-[#58a6ff] text-white'
                : 'text-[#8b949e] hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode('signUp')}
            className={`pb-2 px-1 ${
              mode === 'signUp'
                ? 'border-b-2 border-[#58a6ff] text-white'
                : 'text-[#8b949e] hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {mode === 'signIn' ? <SignInForm /> : <SignUpForm />}
      </div>
    </div>
  )
}
