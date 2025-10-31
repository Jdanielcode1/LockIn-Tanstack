import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useState } from 'react'

interface InlineCommentsProps {
  timelapseId: Id<'timelapses'>
  onAddComment: (content: string) => Promise<void>
}

export function InlineComments({ timelapseId, onAddComment }: InlineCommentsProps) {
  const [commentText, setCommentText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: commentsData } = useSuspenseQuery(
    convexQuery(api.social.getComments, {
      timelapseId,
      paginationOpts: { numItems: 5, cursor: null },
    })
  )

  const handleSubmit = async () => {
    if (!commentText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onAddComment(commentText)
      setCommentText('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="border-t border-[#30363d] bg-[#0d1117]">
      {/* Comment Input */}
      <div className="p-4 border-b border-[#30363d]">
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            TC
          </div>
          <div className="flex-1">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-[#8b949e]">
                Cmd/Ctrl + Enter to post
              </span>
              <button
                onClick={handleSubmit}
                disabled={!commentText.trim() || isSubmitting}
                className="bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-md transition text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Posting...' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="max-h-[300px] overflow-y-auto">
        {commentsData.page.length === 0 ? (
          <div className="p-6 text-center text-[#8b949e] text-sm">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-3.25a.75.75 0 0 0-.53.22L8 15.44l-1.72-1.72a.75.75 0 0 0-.53-.22H2.5A1.5 1.5 0 0 1 1 11.5v-8Zm1.5-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h3.5c.28 0 .549.11.75.31L8 13.56l1.75-1.75c.2-.2.47-.31.75-.31h3.5a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11Z"/>
            </svg>
            <p>No comments yet</p>
            <p className="text-xs mt-1">Be the first to comment!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#30363d]">
            {commentsData.page.map((comment) => (
              <div key={comment._id} className="p-4 hover:bg-[#161b22] transition">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    U
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[#c9d1d9]">
                        User
                      </span>
                      <span className="text-xs text-[#8b949e]">
                        {getRelativeTime(comment._creationTime)}
                      </span>
                    </div>
                    <p className="text-sm text-[#c9d1d9] whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {commentsData.page.length > 0 && !commentsData.isDone && (
        <div className="p-3 border-t border-[#30363d] text-center">
          <button className="text-xs text-[#58a6ff] hover:underline">
            View all comments
          </button>
        </div>
      )}
    </div>
  )
}

