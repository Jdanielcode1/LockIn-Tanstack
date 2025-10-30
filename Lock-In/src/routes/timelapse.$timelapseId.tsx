import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useEffect, useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { VideoPlayer } from '../components/VideoPlayer'

export const Route = createFileRoute('/timelapse/$timelapseId')({
  component: TimelapseDetail,
})

function TimelapseDetail() {
  const { timelapseId } = Route.useParams()
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')

  const { data: timelapse } = useSuspenseQuery(
    convexQuery(api.timelapses.get, {
      timelapseId: timelapseId as Id<'timelapses'>,
    })
  )

  const { data: isLiked } = useSuspenseQuery(
    convexQuery(api.social.isLiked, {
      timelapseId: timelapseId as Id<'timelapses'>,
    })
  )

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700">
            Timelapse not found
          </h2>
          <Link
            to="/"
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Back to Feed
          </Link>
        </div>
      </div>
    )
  }

  const handleLike = async () => {
    await toggleLike({ timelapseId: timelapseId as Id<'timelapses'> })
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    await addComment({
      timelapseId: timelapseId as Id<'timelapses'>,
      content: newComment,
    })
    setNewComment('')
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Feed
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
              <VideoPlayer videoKey={timelapse.videoKey} className="aspect-video" />
              <div className="p-6">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: timelapse.projectId }}
                  className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition"
                >
                  {timelapse.projectTitle}
                </Link>
                <div className="flex items-center gap-6 mt-4 text-gray-600">
                  <span>⏱️ {timelapse.durationMinutes} minutes</span>
                  <span>👁️ {timelapse.viewCount} views</span>
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-1 hover:text-red-500 transition ${
                      isLiked ? 'text-red-500' : ''
                    }`}
                  >
                    {isLiked ? '❤️' : '🤍'} {timelapse.likeCount}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Comments</h2>
              <form onSubmit={handleComment} className="mb-6">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
                <button
                  type="submit"
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                >
                  Post Comment
                </button>
              </form>

              <div className="space-y-4">
                {commentsData.page.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  <>
                    {commentsData.page.map((comment) => (
                      <div
                        key={comment._id}
                        className="border-b border-gray-200 pb-4 last:border-0"
                      >
                        <p className="text-gray-800">{comment.content}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(comment.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                    {!commentsData.isDone && (
                      <button
                        onClick={() =>
                          setCommentsCursor(commentsData.continueCursor)
                        }
                        className="text-blue-600 hover:underline"
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
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                About This Project
              </h3>
              <Link
                to="/projects/$projectId"
                params={{ projectId: timelapse.projectId }}
                className="block text-blue-600 hover:underline font-semibold mb-2"
              >
                View Project Details →
              </Link>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Uploaded on{' '}
                  {new Date(timelapse.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

