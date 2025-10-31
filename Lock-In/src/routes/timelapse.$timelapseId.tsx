import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useEffect, useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { VideoPlayer } from '../components/VideoPlayer'
import { useUser } from '../components/UserProvider'

export const Route = createFileRoute('/timelapse/$timelapseId')({
  component: TimelapseDetail,
})

function TimelapseDetail() {
  const { user } = useUser()
  const { timelapseId } = Route.useParams()
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')

  const { data: timelapse } = useSuspenseQuery(
    convexQuery(api.timelapses.get, {
      timelapseId: timelapseId as Id<'timelapses'>,
    })
  )

  const { data: isLiked } = useQuery({
    ...convexQuery(api.social.isLiked, {
      userId: user?.userId || ('' as Id<'users'>),
      timelapseId: timelapseId as Id<'timelapses'>,
    }),
    enabled: !!user,
  })

  const { data: commentsData } = useSuspenseQuery(
    convexQuery(api.social.getComments, {
      timelapseId: timelapseId as Id<'timelapses'>,
      paginationOpts: { numItems: 10, cursor: commentsCursor },
    })
  )

  const incrementView = useMutation(api.timelapses.incrementViewCount)
  const toggleLike = useMutation(api.social.toggleLike)
  const addComment = useMutation(api.social.addComment)

  useEffect(() => {
    incrementView({ timelapseId: timelapseId as Id<'timelapses'> })
  }, [timelapseId])

  if (!timelapse) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#c9d1d9]">
            Timelapse not found
          </h2>
          <Link
            to="/"
            className="text-[#58a6ff] hover:underline mt-4 inline-block"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    )
  }

  const handleLike = async () => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }
    await toggleLike({
      userId: user.userId,
      timelapseId: timelapseId as Id<'timelapses'>
    })
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    if (!user) {
      alert('Please set up your profile first')
      return
    }

    await addComment({
      userId: user.userId,
      timelapseId: timelapseId as Id<'timelapses'>,
      content: newComment,
    })
    setNewComment('')
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        <Link
          to="/"
          className="text-[#58a6ff] hover:underline mb-6 inline-flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"/>
          </svg>
          Back to Feed
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden mb-6">
              <VideoPlayer videoKey={timelapse.videoKey} className="aspect-video" />
              <div className="p-6">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: timelapse.projectId }}
                  className="text-2xl font-bold text-[#c9d1d9] hover:text-[#58a6ff] transition"
                >
                  {timelapse.projectTitle}
                </Link>
                <div className="flex items-center gap-6 mt-4 text-[#8b949e]">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                    </svg>
                    {timelapse.durationMinutes} minutes
                  </span>
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8ZM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8Z"/>
                      <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"/>
                    </svg>
                    {timelapse.viewCount} views
                  </span>
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 hover:text-red-400 transition ${
                      isLiked ? 'text-red-400' : ''
                    }`}
                  >
                    <svg className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16">
                      <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>
                    </svg>
                    {timelapse.likeCount}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-6">
              <h2 className="text-xl font-bold text-[#c9d1d9] mb-4">Comments</h2>
              <form onSubmit={handleComment} className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] text-[#c9d1d9] placeholder-[#8b949e] rounded-md focus:ring-2 focus:ring-[#58a6ff] focus:border-[#58a6ff] transition"
                  rows={3}
                />
                <button
                  type="submit"
                  className="mt-2 bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md transition font-medium"
                >
                  Post Comment
                </button>
              </form>

              <div className="space-y-4">
                {commentsData.page.length === 0 ? (
                  <p className="text-[#8b949e] text-center py-8">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  <>
                    {commentsData.page.map((comment) => (
                      <div
                        key={comment._id}
                        className="border-b border-[#30363d] pb-4 last:border-0"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#21262d] flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                              <path d="M8 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM6.5 8a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V8Z"/>
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-[#c9d1d9]">
                                {comment.user?.displayName || 'Anonymous'}
                              </span>
                              <span className="text-sm text-[#8b949e]">
                                @{comment.user?.username || 'unknown'}
                              </span>
                              <span className="text-sm text-[#8b949e]">•</span>
                              <span className="text-sm text-[#8b949e]">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[#c9d1d9]">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!commentsData.isDone && (
                      <button
                        onClick={() =>
                          setCommentsCursor(commentsData.continueCursor)
                        }
                        className="text-[#58a6ff] hover:underline font-medium"
                      >
                        Load more comments
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-6 sticky top-4">
              <h3 className="text-lg font-bold text-[#c9d1d9] mb-4">
                About This Project
              </h3>
              <Link
                to="/projects/$projectId"
                params={{ projectId: timelapse.projectId }}
                className="inline-flex items-center gap-2 text-[#58a6ff] hover:underline font-semibold mb-4"
              >
                View Project Details
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"/>
                </svg>
              </Link>
              <div className="mt-4 pt-4 border-t border-[#30363d]">
                <div className="flex items-center gap-2 text-sm text-[#8b949e]">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                  </svg>
                  <span>
                    Uploaded on {new Date(timelapse.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

