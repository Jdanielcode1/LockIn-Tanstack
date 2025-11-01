interface ProcessingStatusBadgeProps {
  status?: 'pending' | 'processing' | 'complete' | 'failed'
  showLabel?: boolean
}

export function ProcessingStatusBadge({ status, showLabel = true }: ProcessingStatusBadgeProps) {
  if (!status || status === 'complete') return null

  const statusConfig = {
    pending: {
      color: 'bg-[#58a6ff]',
      textColor: 'text-[#58a6ff]',
      label: 'Queued for processing',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
        </svg>
      ),
    },
    processing: {
      color: 'bg-[#f0883e]',
      textColor: 'text-[#f0883e]',
      label: 'Processing video',
      icon: (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
      ),
    },
    failed: {
      color: 'bg-[#f85149]',
      textColor: 'text-[#f85149]',
      label: 'Processing failed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M2.343 13.657A8 8 0 1 1 13.657 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z"/>
        </svg>
      ),
    },
  }

  const config = statusConfig[status]

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#161b22] border border-[#30363d]">
      <div className={config.textColor}>
        {config.icon}
      </div>
      {showLabel && (
        <span className="text-xs text-[#c9d1d9] font-medium">
          {config.label}
        </span>
      )}
    </div>
  )
}
