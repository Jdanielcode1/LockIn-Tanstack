import { useState } from 'react'

interface QuickActionButtonProps {
  onClick: () => void
}

export function QuickActionButton({ onClick }: QuickActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {/* Expanded Menu */}
      {isExpanded && (
        <div className="absolute bottom-16 right-0 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl p-2 mb-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => {
              onClick()
              setIsExpanded(false)
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md hover:bg-[#30363d] transition text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#238636] flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#c9d1d9]">New Project</div>
              <div className="text-xs text-[#8b949e]">Start tracking progress</div>
            </div>
          </button>

          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md hover:bg-[#30363d] transition text-left group opacity-50 cursor-not-allowed"
            disabled
          >
            <div className="w-10 h-10 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#8b949e]">Upload Video</div>
              <div className="text-xs text-[#8b949e]">Coming soon</div>
            </div>
          </button>
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 rounded-full bg-gradient-to-r from-[#238636] to-[#2ea043] shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group ${
          isExpanded ? 'rotate-45' : ''
        }`}
      >
        <svg 
          className="w-6 h-6 text-white transition-transform" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-transparent -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  )
}

