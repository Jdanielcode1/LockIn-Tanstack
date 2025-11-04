import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Avatar } from '../components/Avatar'
import { useUser } from '../components/UserProvider'
import { CreateChallengeModal } from '../components/CreateChallengeModal'
import type { Id } from '../../convex/_generated/dataModel'
import { useState } from 'react'

export const Route = createFileRoute('/clubs/$clubId')({
  component: ClubDetail,
})

function ClubDetail() {
  const { clubId } = Route.useParams()
  const { user } = useUser()
  const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false)

  const { data: club } = useSuspenseQuery(
    convexQuery(api.clubs.get, { clubId: clubId as Id<'clubs'> })
  )

  const { data: members } = useSuspenseQuery(
    convexQuery(api.clubs.getMembers, { clubId: clubId as Id<'clubs'> })
  )

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.clubs.getStats, { clubId: clubId as Id<'clubs'> })
  )

  const { data: activity } = useSuspenseQuery(
    convexQuery(api.clubs.getActivity, { clubId: clubId as Id<'clubs'>, limit: 12 })
  )

  const { data: challenges } = useSuspenseQuery(
    convexQuery(api.clubs.getChallenges, { clubId: clubId as Id<'clubs'>, limit: 5 })
  )

  const { data: leaderboard } = useSuspenseQuery(
    convexQuery(api.clubs.getLeaderboard, { clubId: clubId as Id<'clubs'>, limit: 10 })
  )

  const { data: isMember } = useQuery({
    ...convexQuery(api.clubs.isMember, {
      clubId: clubId as Id<'clubs'>,
      userId: user?.userId || ('' as any),
    }),
    enabled: !!user,
  })

  const joinMutation = useMutation(api.clubs.join)
  const leaveMutation = useMutation(api.clubs.leave)

  const handleJoinClub = async () => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await joinMutation({ clubId: clubId as Id<'clubs'>, userId: user.userId })
    } catch (error) {
      console.error('Error joining club:', error)
      alert('Failed to join club')
    }
  }

  const handleLeaveClub = async () => {
    if (!user) return

    try {
      await leaveMutation({ clubId: clubId as Id<'clubs'>, userId: user.userId })
    } catch (error) {
      console.error('Error leaving club:', error)
      alert('Failed to leave club')
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'coding':
        return '💻'
      case 'study':
        return '📚'
      case 'fitness':
        return '💪'
      default:
        return '👥'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'coding':
        return 'from-blue-500 to-indigo-600'
      case 'study':
        return 'from-purple-500 to-pink-600'
      case 'fitness':
        return 'from-orange-500 to-red-600'
      default:
        return 'from-green-500 to-teal-600'
    }
  }

  if (!club) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e]">Club not found</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        {/* Header with gradient */}
        <div className={`relative rounded-lg overflow-hidden mb-8 bg-gradient-to-br ${getTypeColor(club.type)}`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative p-8">
            <Link
              to="/clubs"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
              </svg>
              Back to Clubs
            </Link>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-6xl">{getTypeIcon(club.type)}</div>
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{club.name}</h1>
                    <span className="inline-block text-sm bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-white capitalize">
                      {club.type}
                    </span>
                  </div>
                </div>
                <p className="text-white/90 text-lg max-w-2xl">{club.description}</p>
              </div>

              {user && (
                <div>
                  {isMember ? (
                    <button
                      onClick={handleLeaveClub}
                      className="bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white px-6 py-2.5 rounded-md hover:bg-white/20 transition font-medium"
                    >
                      Leave Club
                    </button>
                  ) : (
                    <button
                      onClick={handleJoinClub}
                      className="bg-white text-gray-900 px-6 py-2.5 rounded-md hover:bg-white/90 transition font-medium shadow-lg"
                    >
                      Join Club
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/70 text-sm mb-1">Members</div>
                <div className="text-2xl font-bold text-white">{stats?.totalMembers || 0}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/70 text-sm mb-1">Total Hours</div>
                <div className="text-2xl font-bold text-white">{stats?.totalHours || 0}h</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/70 text-sm mb-1">Timelapses</div>
                <div className="text-2xl font-bold text-white">{stats?.totalTimelapses || 0}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="text-white/70 text-sm mb-1">Active This Week</div>
                <div className="text-2xl font-bold text-white">{stats?.activeThisWeek || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column - Challenges & Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Club Challenges */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#c9d1d9]">Club Challenges</h2>
                <div className="flex items-center gap-3">
                  {isMember && (
                    <button
                      onClick={() => setShowCreateChallengeModal(true)}
                      className="text-sm bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-md transition font-medium flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
                      </svg>
                      Create
                    </button>
                  )}
                  <Link
                    to="/challenges"
                    className="text-sm text-[#58a6ff] hover:underline"
                  >
                    View All →
                  </Link>
                </div>
              </div>

              {challenges && challenges.length > 0 ? (
                <div className="space-y-3">
                  {challenges.map((challenge: any) => (
                    <Link
                      key={challenge._id}
                      to="/challenges/$challengeId"
                      params={{ challengeId: challenge._id }}
                      className="block p-4 rounded-md bg-[#0d1117] border border-[#30363d] hover:border-[#8b949e] transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-[#c9d1d9] mb-1">
                            {challenge.title}
                          </h3>
                          <p className="text-xs text-[#8b949e] line-clamp-2 mb-2">
                            {challenge.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-[#8b949e]">
                            <span>{challenge.participantCount} participants</span>
                            {challenge.goal && <span>{challenge.goal}</span>}
                          </div>
                        </div>
                        <span className="text-xs bg-[#21262d] border border-[#30363d] px-2 py-1 rounded capitalize">
                          {challenge.type}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-[#8b949e] text-3xl mb-2">🎯</div>
                  <p className="text-[#8b949e] text-sm">No challenges yet</p>
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#c9d1d9]">
                  Recent Activity
                </h2>
              </div>

              {activity && activity.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activity.map((item: any) => (
                    <ActivityItem key={item._id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-[#8b949e] text-4xl mb-2">📹</div>
                  <p className="text-[#8b949e]">No timelapses yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Leaderboard */}
          <div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-md p-6 sticky top-6">
              <h2 className="text-xl font-bold text-[#c9d1d9] mb-6">Leaderboard</h2>

              {leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center gap-3 p-3 rounded-md bg-[#0d1117] border border-[#30363d]"
                    >
                      <div className="text-lg font-bold text-[#8b949e] w-6">
                        {member.rank <= 3 ? (
                          <span className="text-xl">
                            {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          `#${member.rank}`
                        )}
                      </div>
                      <Avatar
                        avatarKey={member.avatarKey}
                        displayName={member.displayName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#c9d1d9] truncate">
                          {member.displayName}
                        </div>
                        <div className="text-xs text-[#8b949e]">
                          {member.totalHours}h · {member.timelapseCount} videos
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-[#8b949e] text-3xl mb-2">🏆</div>
                  <p className="text-[#8b949e] text-sm">No activity yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[#c9d1d9]">
              Members ({members?.length || 0})
            </h2>
          </div>

          {members && members.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member: any) => (
                <div
                  key={member._id}
                  className="bg-[#0d1117] border border-[#30363d] rounded-md p-4 hover:border-[#8b949e] transition"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      avatarKey={member.avatarKey}
                      displayName={member.displayName}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#c9d1d9] truncate">
                        {member.displayName}
                      </div>
                      {member.location && (
                        <div className="text-xs text-[#8b949e] truncate flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                          </svg>
                          {member.location}
                        </div>
                      )}
                      {member.bio && (
                        <div className="text-xs text-[#8b949e] line-clamp-2 mt-1">
                          {member.bio}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-[#8b949e] text-4xl mb-2">👥</div>
              <p className="text-[#8b949e]">No members yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Challenge Modal */}
      {showCreateChallengeModal && (
        <CreateChallengeModal
          onClose={() => setShowCreateChallengeModal(false)}
          clubId={clubId as Id<'clubs'>}
          clubName={club.name}
        />
      )}
    </main>
  )
}

function ActivityItem({ item }: { item: any }) {
  const { data: thumbnailUrl } = useSuspenseQuery(
    convexQuery(api.r2.getThumbnailUrl, {
      thumbnailKey: item.thumbnailKey || item.videoKey,
    })
  )

  const isVertical = item.videoHeight && item.videoWidth && item.videoHeight > item.videoWidth

  const getAspectRatioClass = () => {
    if (!item.videoWidth || !item.videoHeight) return 'aspect-video'
    if (isVertical) return ''
    return 'aspect-video'
  }

  return (
    <Link
      to="/timelapse/$timelapseId"
      params={{ timelapseId: item._id }}
      className="group"
    >
      <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition flex flex-col">
        {/* Thumbnail */}
        <div
          className={`${
            isVertical ? 'aspect-[9/16] max-h-[450px] mx-auto w-full' : getAspectRatioClass()
          } bg-[#0d1117] flex items-center justify-center relative overflow-hidden`}
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Timelapse thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-[#8b949e]">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z" />
                <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-semibold text-[#c9d1d9] truncate">
              {item.user?.displayName || 'Unknown'}
            </div>
          </div>

          {item.project && (
            <div className="text-xs text-[#8b949e] mb-2 truncate">
              {item.project.title}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-[#8b949e]">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
                  <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                </svg>
                {item.viewCount}
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z" />
                </svg>
                {item.likeCount}
              </div>
            </div>

            <Avatar
              avatarKey={item.user?.avatarKey}
              displayName={item.user?.displayName || 'Unknown'}
              size="xs"
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
