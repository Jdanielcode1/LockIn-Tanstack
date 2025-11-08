import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState, Suspense, useEffect, useRef, useCallback } from 'react'
import { useMutation, usePaginatedQuery } from 'convex/react'
import type { Id } from '../../convex/_generated/dataModel'
import { CreateProjectModal } from '../components/CreateProjectModal'
import { AllProjectsModal } from '../components/AllProjectsModal'
import { InlineVideoPlayer } from '../components/InlineVideoPlayer'
import { InlineComments } from '../components/InlineComments'
import { QuickActionButton } from '../components/QuickActionButton'
import { useUser } from '../components/UserProvider'
import { Avatar } from '../components/Avatar'
import { RightSidebar } from '../components/RightSidebar'

export const Route = createFileRoute('/')({
  loader: async (opts) => {
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.timelapses.listFeed, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.stats.getOverallStats, {})
      ),
    ])
  },
  component: Feed,
})

function Feed() {
  const { user } = useUser()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false)
  const [commentingOn, setCommentingOn] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Use Convex's built-in paginated query for smooth pagination
  const { results: allItems, status, loadMore } = usePaginatedQuery(
    api.timelapses.listFeed,
    {},
    { initialNumItems: 10 }
  )

  // Derived states from Convex pagination status
  const hasNextPage = status === "CanLoadMore"
  const isFetchingNextPage = status === "LoadingMore"

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.stats.getOverallStats, {})
  )

  // Fetch user profile data
  const { data: profileData } = useQuery({
    ...convexQuery(api.users.getUser, {
      userId: user?.userId!,
    }),
    enabled: !!user,
  })

  // Use regular useQuery for projects since it's conditional on user existing
  const { data: myProjectsData } = useQuery({
    ...convexQuery(api.projects.list, {
      userId: user?.userId || ('' as any),
      paginationOpts: { numItems: 4, cursor: null },
    }),
    enabled: !!user,
  })

  const [localLikes, setLocalLikes] = useState<Record<string, number>>({})
  const [localLiked, setLocalLiked] = useState<Set<string>>(new Set())
  const [likingInProgress, setLikingInProgress] = useState<Set<string>>(new Set())
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [showComments, setShowComments] = useState<string | null>(null)

  const toggleLikeMutation = useMutation(api.social.toggleLike)
  const addCommentMutation = useMutation(api.social.addComment)

  // Intersection Observer for infinite scroll
  const loadMoreItems = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      loadMore(10)
    }
  }, [hasNextPage, isFetchingNextPage, loadMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreItems()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMoreItems])

  const handleLike = async (timelapseId: Id<'timelapses'>, currentLikes: number) => {
    // Prevent double-clicking
    if (likingInProgress.has(timelapseId)) return

    if (!user) {
      alert('Please set up your profile first')
      return
    }

    // Mark as in progress
    setLikingInProgress(prev => new Set(prev).add(timelapseId))

    // Optimistic update
    const wasLiked = localLiked.has(timelapseId)
    const newLikes = wasLiked ? currentLikes - 1 : currentLikes + 1

    setLocalLikes(prev => ({ ...prev, [timelapseId]: newLikes }))
    setLocalLiked(prev => {
      const newSet = new Set(prev)
      if (wasLiked) {
        newSet.delete(timelapseId)
      } else {
        newSet.add(timelapseId)
      }
      return newSet
    })

    try {
      console.log('Calling toggleLike mutation...')
      const result = await toggleLikeMutation({
        userId: user.userId,
        timelapseId
      })
      console.log('Mutation result:', result)
      
      // Update local state based on server response
      if (result.liked) {
        console.log('Video is now liked')
        setLocalLiked(prev => new Set(prev).add(timelapseId))
      } else {
        console.log('Video is now unliked')
        setLocalLiked(prev => {
          const newSet = new Set(prev)
          newSet.delete(timelapseId)
          return newSet
        })
      }
    } catch (error) {
      // Revert on error
      setLocalLikes(prev => ({ ...prev, [timelapseId]: currentLikes }))
      setLocalLiked(prev => {
        const newSet = new Set(prev)
        if (wasLiked) {
          newSet.add(timelapseId)
        } else {
          newSet.delete(timelapseId)
        }
        return newSet
      })
      console.error('Error toggling like:', error)
      alert('Failed to update like. Please try again.')
    } finally {
      // Remove from in-progress
      setLikingInProgress(prev => {
        const newSet = new Set(prev)
        newSet.delete(timelapseId)
        return newSet
      })
    }
  }

  const handleComment = async (timelapseId: Id<'timelapses'>) => {
    if (!commentText.trim()) return

    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await addCommentMutation({
        userId: user.userId,
        timelapseId,
        content: commentText
      })
      setCommentText('')
      setCommentingOn(null)
    } catch (error) {
      console.error('Error commenting:', error)
    }
  }

  const getLikeCount = (timelapseId: string, originalCount: number) => {
    return localLikes[timelapseId] ?? originalCount
  }

  const isLiked = (timelapseId: string) => {
    return localLiked.has(timelapseId)
  }

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    return `${days} day${days !== 1 ? 's' : ''} ago`
  }

  const getCurrentWeek = () => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    return startOfWeek.getTime()
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px] gap-6">
          {/* Left Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              {/* Profile Card */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <div className="flex flex-col items-center mb-4">
                  {profileData ? (
                    <Avatar
                      avatarKey={profileData.avatarKey}
                      displayName={profileData.displayName}
                      size="xl"
                      className="mb-3"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#161b22] border-2 border-[#30363d] flex items-center justify-center mb-3">
                      <div className="animate-spin text-2xl text-[#8b949e]">⏳</div>
                    </div>
                  )}
                  <h2 className="text-lg font-semibold text-[#c9d1d9]">
                    {profileData?.displayName || 'Loading...'}
                  </h2>
                  <Link to="/projects" className="text-sm text-[#8b949e] hover:text-[#58a6ff] transition">
                    View Profile
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-3 border-t border-[#30363d]">
                  <div>
                    <div className="text-[#c9d1d9] font-semibold text-lg">{stats.totalProjects}</div>
                    <div className="text-xs text-[#8b949e]">Projects</div>
                  </div>
                  <div>
                    <div className="text-[#c9d1d9] font-semibold text-lg">{stats.totalTimelapses}</div>
                    <div className="text-xs text-[#8b949e]">Uploads</div>
                  </div>
                  <div>
                    <div className="text-[#c9d1d9] font-semibold text-lg">{stats.totalHours.toFixed(0)}</div>
                    <div className="text-xs text-[#8b949e]">Hours</div>
                  </div>
                </div>
              </div>

              {/* New Project Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full bg-[#238636] hover:bg-[#2ea043] text-white text-center py-2.5 rounded-md transition text-sm font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
                </svg>
                New Project
              </button>

              {/* Latest My Projects */}
              {user && myProjectsData && myProjectsData.page.length > 0 && (
                <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                  <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">Latest My Projects</h3>
                  <div className="space-y-2">
                    {myProjectsData.page.map((project) => {
                      const progress = Math.min((project.completedHours / project.targetHours) * 100, 100)
                      return (
                        <Link
                          key={project._id}
                          to="/projects/$projectId"
                          params={{ projectId: project._id }}
                          className="block p-2 rounded hover:bg-[#0d1117] transition group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-[#c9d1d9] font-medium group-hover:text-[#58a6ff] transition line-clamp-1">
                              {project.title}
                            </p>
                            <span className="text-xs text-[#8b949e] ml-2 flex-shrink-0">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-[#21262d] rounded-full h-1">
                            <div
                              className="bg-[#238636] h-1 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setShowAllProjectsModal(true)}
                    className="w-full mt-3 text-sm text-[#58a6ff] hover:text-[#79c0ff] transition text-center"
                  >
                    Show more →
                  </button>
                </div>
              )}

              {/* Latest Activity */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">Latest Activity</h3>
                {allItems.length > 0 ? (
                  <div>
                    <p className="text-sm text-[#c9d1d9] font-medium mb-1">
                      {allItems[0].projectTitle}
                    </p>
                    <p className="text-xs text-[#8b949e]">
                      {getRelativeTime(allItems[0].uploadedAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#8b949e]">No recent activity</p>
                )}
              </div>

              {/* Upload Streak */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">Your Streak</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#0d1117] flex flex-col items-center justify-center border border-[#30363d]">
                    <div className="text-xl">🔥</div>
                  </div>
                  <div>
                    <p className="text-sm text-[#8b949e]">Upload a timelapse to start your streak</p>
                  </div>
                </div>
              </div>

              {/* Activity Types */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">Your Progress</h3>
                <div className="grid grid-cols-4 gap-2">
                  <button className="flex flex-col items-center gap-1 p-2 rounded hover:bg-[#30363d] transition">
                    <svg className="w-6 h-6 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
                    </svg>
                    <span className="text-xs text-[#8b949e]">Projects</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 p-2 rounded hover:bg-[#30363d] transition">
                    <svg className="w-6 h-6 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                      <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                    </svg>
                    <span className="text-xs text-[#8b949e]">Videos</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 p-2 rounded hover:bg-[#30363d] transition">
                    <svg className="w-6 h-6 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                    </svg>
                    <span className="text-xs text-[#8b949e]">Time</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 p-2 rounded hover:bg-[#30363d] transition">
                    <svg className="w-6 h-6 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
                    </svg>
                    <span className="text-xs text-[#8b949e]">Goals</span>
                  </button>
                </div>
              </div>

              {/* This Week Stats */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <h3 className="text-sm font-semibold text-[#c9d1d9] mb-2 text-center">THIS WEEK</h3>
                <div className="text-center mb-3">
                  <div className="text-2xl font-bold text-[#c9d1d9]">
                    {stats.totalTimelapses}
                  </div>
                  <div className="text-xs text-[#8b949e]">uploads</div>
                </div>
                
                {/* Week Calendar */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-3">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i} className="text-[#8b949e]">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square flex items-center justify-center text-xs text-[#8b949e]"
                    >
                      --
                    </div>
                  ))}
                </div>

                <div className="text-center pt-3 border-t border-[#30363d]">
                  <div className="text-xl font-bold text-[#c9d1d9] mb-1">
                    {stats.totalHours.toFixed(1)}h
                  </div>
                  <div className="text-xs text-[#8b949e]">total this week</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Feed */}
          <div className="max-w-[680px] mx-auto">
            {allItems.length === 0 ? (
              <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-md">
                <div className="text-[#8b949e] text-6xl mb-4">📹</div>
                <h2 className="text-2xl font-semibold text-[#c9d1d9] mb-2">
                  No activities yet
                </h2>
                <p className="text-[#8b949e] mb-6 text-sm">
                  Be the first to share your project progress!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-block bg-[#238636] text-white px-4 py-2 rounded-md hover:bg-[#2ea043] transition text-sm font-medium"
                >
                  Create a Project
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {allItems.map((timelapse) => (
                    <article
                      key={timelapse._id}
                      className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition"
                    >
                      {/* Activity Header */}
                      <div className="p-4 flex items-start gap-3">
                        <Avatar
                          avatarKey={timelapse.user.avatarKey}
                          displayName={timelapse.user.displayName}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#c9d1d9] font-semibold text-sm">
                              {timelapse.user.displayName}
                            </span>
                            <span className="text-[#8b949e] text-xs">·</span>
                            <span className="text-[#8b949e] text-xs">
                              {getRelativeTime(timelapse.uploadedAt)}
                            </span>
                          </div>
                          <Link
                            to="/timelapse/$timelapseId"
                            params={{ timelapseId: timelapse._id }}
                            className="text-[#c9d1d9] font-semibold hover:text-[#58a6ff] transition"
                          >
                            {timelapse.projectTitle}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[#8b949e]">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                              </svg>
                              {timelapse.durationMinutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 0a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 6.293V.5A.5.5 0 0 1 8 0Z"/>
                                <path d="M3 7.5a.5.5 0 0 1 .5.5v5.5h9V8a.5.5 0 0 1 1 0v6a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 2 14V8a.5.5 0 0 1 .5-.5Z"/>
                              </svg>
                              Video Upload
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM2.04 4.326c.325 1.329 2.532 2.54 3.717 3.19.48.263.793.434.743.484-.08.08-.162.158-.242.234-.416.396-.787.749-.758 1.266.035.634.618.824 1.214 1.017.577.188 1.168.38 1.286.983.082.417-.075.988-.22 1.52-.215.782-.406 1.48.22 1.48 1.5-.5 3.798-3.186 4-5 .138-1.243-2-2-3.5-2.5-.478-.16-.755.081-.99.284-.172.15-.322.279-.51.216-.445-.148-2.5-2-1.5-2.5.78-.39.952-.171 1.227.182.078.099.163.208.273.318.609.304.662-.132.723-.633.039-.322.081-.671.277-.867.434-.434 1.265-.791 2.028-1.12.712-.306 1.365-.587 1.579-.88A7 7 0 1 1 2.04 4.327Z"/>
                              </svg>
                              {new Date(timelapse.uploadedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Video Player */}
                      <InlineVideoPlayer
                        videoKey={timelapse.videoKey}
                        thumbnailKey={timelapse.thumbnailKey}
                        isPlaying={playingVideo === timelapse._id}
                        onTogglePlay={() => {
                          if (playingVideo === timelapse._id) {
                            setPlayingVideo(null)
                          } else {
                            setPlayingVideo(timelapse._id)
                          }
                        }}
                        videoWidth={timelapse.videoWidth}
                        videoHeight={timelapse.videoHeight}
                      />

                      {/* Interaction Footer */}
                      <div className="p-4">
                        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => {
                              console.log('Like button clicked for:', timelapse._id)
                              handleLike(timelapse._id, timelapse.likeCount)
                            }}
                            disabled={likingInProgress.has(timelapse._id)}
                            className={`flex items-center gap-1.5 transition group disabled:opacity-50 disabled:cursor-not-allowed ${
                              isLiked(timelapse._id)
                                ? 'text-[#f85149]'
                                : 'text-[#8b949e] hover:text-[#f85149]'
                            }`}
                          >
                            {likingInProgress.has(timelapse._id) ? (
                              <div className="w-4 h-4 animate-spin">⏳</div>
                            ) : (
                              <svg 
                                className={`w-4 h-4 transition-transform ${
                                  isLiked(timelapse._id) ? 'scale-110' : 'group-hover:scale-110'
                                }`}
                                fill={isLiked(timelapse._id) ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeWidth={isLiked(timelapse._id) ? 0 : 2}
                                viewBox="0 0 16 16"
                              >
                                <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>
                              </svg>
                            )}
                            <span className="font-medium">
                              {getLikeCount(timelapse._id, timelapse.likeCount)}
                            </span>
                          </button>
                          
                          <button 
                            onClick={() => setShowComments(showComments === timelapse._id ? null : timelapse._id)}
                            className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#58a6ff] transition"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-3.25a.75.75 0 0 0-.53.22L8 15.44l-1.72-1.72a.75.75 0 0 0-.53-.22H2.5A1.5 1.5 0 0 1 1 11.5v-8Zm1.5-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h3.5c.28 0 .549.11.75.31L8 13.56l1.75-1.75c.2-.2.47-.31.75-.31h3.5a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11Z"/>
                            </svg>
                            <span>Comment</span>
          </button>

          <Link
                            to="/timelapse/$timelapseId"
                            params={{ timelapseId: timelapse._id }}
                            className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#58a6ff] transition"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z"/>
                              <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z"/>
                            </svg>
                            <span className="text-xs">View Details</span>
                          </Link>
                          
                          <div className="flex items-center gap-1.5 text-[#8b949e] ml-auto">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8ZM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8Z"/>
                              <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"/>
                            </svg>
                            <span>{timelapse.viewCount}</span>
                          </div>
                        </div>
                      </div>

                      {/* Comments Section */}
                      {showComments === timelapse._id && (
                        <Suspense
                          fallback={
                            <div className="p-4 border-t border-[#30363d] text-center text-[#8b949e]">
                              <div className="animate-spin text-2xl inline-block">⏳</div>
                              <p className="text-xs mt-2">Loading comments...</p>
                            </div>
                          }
                        >
                          <InlineComments
                            timelapseId={timelapse._id}
                            onAddComment={async (content) => {
                              if (!user) {
                                alert('Please set up your profile first')
                                return
                              }
                              await addCommentMutation({
                                userId: user.userId,
                                timelapseId: timelapse._id,
                                content,
                              })
                            }}
                          />
                        </Suspense>
                      )}
                    </article>
                  ))}
            </div>

                {/* Loading indicator and sentinel for infinite scroll */}
                {hasNextPage && (
                  <div ref={sentinelRef} className="text-center py-8">
                    {isFetchingNextPage && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin text-3xl">⏳</div>
                        <span className="text-xs text-[#8b949e]">Loading more...</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Sidebar */}
          <RightSidebar />
        </div>

        {/* Create Project Modal */}
        {showCreateModal && (
          <CreateProjectModal onClose={() => setShowCreateModal(false)} />
        )}

        {/* All Projects Modal */}
        {showAllProjectsModal && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="animate-spin text-6xl">⏳</div>
            </div>
          }>
            <AllProjectsModal onClose={() => setShowAllProjectsModal(false)} />
          </Suspense>
        )}

        {/* Quick Action Button */}
        <QuickActionButton onClick={() => setShowCreateModal(true)} />
      </div>
    </main>
  )
}

