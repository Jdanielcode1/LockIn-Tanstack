import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useUser } from '../components/UserProvider'
import { Avatar } from '../components/Avatar'

export const Route = createFileRoute('/challenges/$challengeId')({
  component: ChallengeDetail,
})

function ChallengeDetail() {
  const { challengeId } = Route.useParams()
  const { user } = useUser()

  const { data: challenge } = useSuspenseQuery(
    convexQuery(api.challenges.get, {
      challengeId: challengeId as Id<'challenges'>,
    })
  )

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.challenges.getChallengeStats, {
      challengeId: challengeId as Id<'challenges'>,
    })
  )

  const { data: leaderboard } = useSuspenseQuery(
    convexQuery(api.challenges.getChallengeLeaderboard, {
      challengeId: challengeId as Id<'challenges'>,
    })
  )

  const { data: activity } = useSuspenseQuery(
    convexQuery(api.challenges.getChallengeActivity, {
      challengeId: challengeId as Id<'challenges'>,
      limit: 20,
    })
  )

  const { data: isParticipating } = useQuery({
    ...convexQuery(api.challenges.isParticipating, {
      challengeId: challengeId as Id<'challenges'>,
      userId: user?.userId || ('' as any),
    }),
    enabled: !!user,
  })

  const joinMutation = useMutation(api.challenges.join)
  const leaveMutation = useMutation(api.challenges.leave)

  const handleJoin = async () => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }
    try {
      await joinMutation({
        challengeId: challengeId as Id<'challenges'>,
        userId: user.userId,
      })
    } catch (error) {
      console.error('Error joining challenge:', error)
    }
  }

  const handleLeave = async () => {
    if (!user) return
    try {
      await leaveMutation({
        challengeId: challengeId as Id<'challenges'>,
        userId: user.userId,
      })
    } catch (error) {
      console.error('Error leaving challenge:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'reading':
        return '📚'
      case 'study':
        return '🎓'
      case 'workout':
        return '💪'
      default:
        return '🎯'
    }
  }

  const getTypeBorderColor = (type: string) => {
    switch (type) {
      case 'reading':
        return 'border-l-[#1f6feb]'
      case 'study':
        return 'border-l-[#3fb950]'
      case 'workout':
        return 'border-l-[#f0883e]'
      default:
        return 'border-l-[#8b949e]'
    }
  }

  const getTypeBgColor = (type: string) => {
    switch (type) {
      case 'reading':
        return 'bg-[#1f6feb]/5'
      case 'study':
        return 'bg-[#3fb950]/5'
      case 'workout':
        return 'bg-[#f0883e]/5'
      default:
        return 'bg-[#8b949e]/5'
    }
  }

  const getTypeTextColor = (type: string) => {
    switch (type) {
      case 'reading':
        return 'text-[#1f6feb]'
      case 'study':
        return 'text-[#3fb950]'
      case 'workout':
        return 'text-[#f0883e]'
      default:
        return 'text-[#8b949e]'
    }
  }

  if (!challenge || !stats) {
    return (
      <main className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#8b949e]">Challenge not found</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1400px]">
        {/* Back Button */}
        <Link
          to="/challenges"
          className="inline-flex items-center gap-2 text-[#8b949e] hover:text-[#58a6ff] mb-6 transition"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"
            />
          </svg>
          Back to Challenges
        </Link>

        {/* Challenge Header */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden mb-6">
          <div
            className={`h-32 ${getTypeBgColor(challenge.type)} border-l-4 ${getTypeBorderColor(challenge.type)} flex items-center justify-center`}
          >
            <div className="text-7xl">{getTypeIcon(challenge.type)}</div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#c9d1d9] mb-2">
                  {challenge.title}
                </h1>
                <p className="text-[#8b949e] mb-4">{challenge.description}</p>

                {challenge.goal && (
                  <div className="inline-flex items-center gap-2 bg-[#0d1117] border border-[#30363d] px-3 py-2 rounded-md mb-4">
                    <svg
                      className="w-4 h-4 text-[#58a6ff]"
                      fill="currentColor"
                      viewBox="0 0 16 16"
                    >
                      <path d="M2.5 0a.5.5 0 0 1 .5.5V2h10.5a.5.5 0 0 1 0 1H3v10.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 .5-.5Z" />
                      <path d="M15.854 5.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L8 11.293l6.646-6.647a.5.5 0 0 1 .708 0Z" />
                    </svg>
                    <span className="text-sm text-[#c9d1d9]">
                      Goal: <span className="font-semibold">{challenge.goal}</span>
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm text-[#8b949e]">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM1 3.857C1 3.384 1.448 3 2 3h12c.552 0 1 .384 1 .857v10.286c0 .473-.448.857-1 .857H2c-.552 0-1-.384-1-.857V3.857z" />
                      <path d="M6.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                    </svg>
                    <span>
                      {new Date(challenge.startDate).toLocaleDateString()} -{' '}
                      {new Date(challenge.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  {stats.isActive && (
                    <div className="flex items-center gap-1.5 text-[#238636]">
                      <div className="w-2 h-2 rounded-full bg-[#238636] animate-pulse"></div>
                      <span>Active • {stats.daysRemaining} days remaining</span>
                    </div>
                  )}
                </div>
              </div>

              {stats.isActive && (
                <div>
                  {isParticipating ? (
                    <button
                      onClick={handleLeave}
                      className="bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-6 py-2.5 rounded-md hover:bg-[#30363d] transition font-medium"
                    >
                      Leave Challenge
                    </button>
                  ) : (
                    <button
                      onClick={handleJoin}
                      className="bg-[#238636] hover:bg-[#2ea043] text-white px-6 py-2.5 rounded-md transition font-medium"
                    >
                      Join Challenge
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#30363d]">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#c9d1d9]">
                  {stats.totalParticipants}
                </div>
                <div className="text-xs text-[#8b949e]">Participants</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#f0883e]">
                  {stats.totalHours}
                </div>
                <div className="text-xs text-[#8b949e]">Total Hours</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#58a6ff]">
                  {stats.totalTimelapses}
                </div>
                <div className="text-xs text-[#8b949e]">Timelapses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#8b949e]">
                  {stats.avgHoursPerParticipant}
                </div>
                <div className="text-xs text-[#8b949e]">Avg Hours/Person</div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard */}
          <div className="lg:col-span-2">
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg
                  className="w-5 h-5 text-[#f0883e]"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M7.752.066a.5.5 0 0 1 .496 0l3.75 2.143a.5.5 0 0 1 .252.434v3.995l3.498 2A.5.5 0 0 1 16 9.07v4.286a.5.5 0 0 1-.252.434l-3.75 2.143a.5.5 0 0 1-.496 0l-3.502-2-3.502 2.001a.5.5 0 0 1-.496 0l-3.75-2.143A.5.5 0 0 1 0 13.357V9.071a.5.5 0 0 1 .252-.434L3.75 6.638V2.643a.5.5 0 0 1 .252-.434L7.752.066ZM4.25 7.504 1.508 9.071l2.742 1.567 2.742-1.567L4.25 7.504ZM7.5 9.933l-2.75 1.571v3.134l2.75-1.571V9.933Zm1 3.134 2.75 1.571v-3.134L8.5 9.933v3.134Zm.508-3.996 2.742 1.567 2.742-1.567-2.742-1.567-2.742 1.567Zm2.242-2.433V3.504L8.5 5.076V8.21l2.75-1.572ZM7.5 8.21V5.076L4.75 3.504v3.134L7.5 8.21ZM5.258 2.643 8 4.21l2.742-1.567L8 1.076 5.258 2.643ZM15 9.933l-2.75 1.571v3.134L15 13.067V9.933ZM3.75 14.638v-3.134L1 9.933v3.134l2.75 1.571Z" />
                </svg>
                <h2 className="text-xl font-bold text-[#c9d1d9]">Leaderboard</h2>
              </div>

              {leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.map((participant: any, index: number) => (
                    <div
                      key={participant.userId}
                      className={`flex items-center gap-4 p-3 rounded-md ${
                        index === 0
                          ? 'bg-gradient-to-r from-[#f0883e]/10 to-transparent border border-[#f0883e]/30'
                          : index === 1
                            ? 'bg-gradient-to-r from-[#58a6ff]/10 to-transparent border border-[#58a6ff]/30'
                            : index === 2
                              ? 'bg-gradient-to-r from-[#8b949e]/10 to-transparent border border-[#8b949e]/30'
                              : 'bg-[#0d1117] border border-[#30363d]'
                      }`}
                    >
                      {/* Rank */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          index === 0
                            ? 'bg-[#f0883e] text-white'
                            : index === 1
                              ? 'bg-[#58a6ff] text-white'
                              : index === 2
                                ? 'bg-[#8b949e] text-white'
                                : 'bg-[#21262d] text-[#8b949e]'
                        }`}
                      >
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                      </div>

                      {/* User */}
                      <Avatar
                        avatarKey={participant.avatarKey}
                        displayName={participant.displayName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#c9d1d9] truncate">
                          {participant.displayName}
                        </div>
                        <div className="text-xs text-[#8b949e]">
                          @{participant.username} • {participant.timelapsesCount} uploads
                        </div>
                      </div>

                      {/* Hours */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#f0883e]">
                          {participant.totalHours}h
                        </div>
                        {participant.taggedTimelapsesCount > 0 && (
                          <div className="text-xs text-[#8b949e]">
                            {participant.taggedTimelapsesCount} tagged
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-[#8b949e]">
                  No participants yet
                </div>
              )}
            </div>

            {/* Activity Feed */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <svg
                  className="w-5 h-5 text-[#58a6ff]"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z" />
                </svg>
                <h2 className="text-xl font-bold text-[#c9d1d9]">Activity</h2>
              </div>

              {activity && activity.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activity.map((item: any) => (
                    <ActivityItem key={item._id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-[#8b949e]">
                  No activity yet
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Club Info */}
            {challenge.club && (
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#8b949e] mb-3">
                  Club Challenge
                </h3>
                <Link
                  to="/clubs/$clubId"
                  params={{ clubId: challenge.club._id }}
                  className="flex items-center gap-3 p-3 rounded-md bg-[#0d1117] border border-[#30363d] hover:border-[#58a6ff] transition group"
                >
                  <div className="text-3xl">
                    {challenge.club.type === 'coding' ? '💻' :
                     challenge.club.type === 'study' ? '📚' :
                     challenge.club.type === 'fitness' ? '💪' : '👥'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#c9d1d9] group-hover:text-[#58a6ff] transition truncate">
                      {challenge.club.name}
                    </div>
                    <div className="text-xs text-[#8b949e] capitalize">
                      {challenge.club.type} club
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-[#8b949e] group-hover:text-[#58a6ff] transition" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                  </svg>
                </Link>
              </div>
            )}

            {/* Creator Info */}
            {challenge.creator && (
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#8b949e] mb-3">
                  Created by
                </h3>
                <div className="flex items-center gap-3">
                  <Avatar
                    avatarKey={challenge.creator.avatarKey}
                    displayName={challenge.creator.displayName}
                    size="md"
                  />
                  <div>
                    <div className="text-sm font-semibold text-[#c9d1d9]">
                      {challenge.creator.displayName}
                    </div>
                    <div className="text-xs text-[#8b949e]">
                      @{challenge.creator.username}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Info */}
            {isParticipating && user && (
              <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#8b949e] mb-3">
                  Your Progress
                </h3>
                {(() => {
                  const userProgress = leaderboard?.find(
                    (p: any) => p.userId === user.userId
                  )
                  return userProgress ? (
                    <div>
                      <div className="text-3xl font-bold text-[#f0883e] mb-1">
                        {userProgress.totalHours}h
                      </div>
                      <div className="text-xs text-[#8b949e] mb-2">
                        {userProgress.timelapsesCount} timelapses uploaded
                      </div>
                      <div className="text-xs text-[#8b949e]">
                        Rank: #
                        {leaderboard.findIndex((p: any) => p.userId === user.userId) + 1}{' '}
                        of {leaderboard.length}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[#8b949e]">
                      Start uploading timelapses to track your progress!
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Type Badge */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#8b949e] mb-3">
                Challenge Type
              </h3>
              <div
                className={`flex items-center justify-center gap-2 p-3 rounded-md ${getTypeBgColor(challenge.type)} border-l-4 ${getTypeBorderColor(challenge.type)}`}
              >
                <span className="text-3xl">{getTypeIcon(challenge.type)}</span>
                <span className={`text-lg font-bold capitalize ${getTypeTextColor(challenge.type)}`}>
                  {challenge.type}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function ActivityItem({ item }: { item: any }) {
  const { data: thumbnailUrl } = useQuery({
    ...convexQuery(api.r2.getThumbnailUrl, {
      thumbnailKey: item.thumbnailKey || '',
    }),
    enabled: !!item.thumbnailKey,
  })

  // Calculate aspect ratio from video dimensions
  const getAspectRatioClass = () => {
    if (!item.videoWidth || !item.videoHeight) {
      return 'aspect-video' // Default to 16:9 if dimensions not available
    }

    const aspectRatio = item.videoWidth / item.videoHeight

    // Vertical video (TikTok style: 9:16 or portrait)
    if (aspectRatio < 0.8) {
      return 'aspect-[9/16]'
    }
    // Horizontal video (YouTube style: 16:9 or landscape)
    else if (aspectRatio > 1.2) {
      return 'aspect-video'
    }
    // Square-ish video
    else {
      return 'aspect-square'
    }
  }

  // Check if vertical video to apply max height constraint
  const isVertical = item.videoWidth && item.videoHeight && (item.videoWidth / item.videoHeight) < 0.8

  return (
    <Link
      to="/timelapse/$timelapseId"
      params={{ timelapseId: item._id }}
      className="group"
    >
      <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition flex flex-col">
        <div className={`${isVertical ? 'aspect-[9/16] max-h-[450px] mx-auto w-full' : getAspectRatioClass()} bg-[#0d1117] flex items-center justify-center relative overflow-hidden`}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt="Timelapse thumbnail"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10"></div>
          )}

          {!thumbnailUrl && (
            <svg className="w-16 h-16 text-[#8b949e] relative z-10 group-hover:text-[#58a6ff] transition" fill="currentColor" viewBox="0 0 16 16">
              <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
              <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
            </svg>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-sm font-semibold text-[#c9d1d9] truncate">
              {item.user?.displayName || 'Unknown'}
            </div>
            {item.isTagged && (
              <span className="text-xs bg-[#238636]/20 text-[#238636] px-2 py-0.5 rounded">
                Tagged
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2 text-sm text-[#8b949e]">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
            </svg>
            <span className="text-[#c9d1d9]">{item.durationMinutes} minutes</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-[#8b949e]">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8ZM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8Z"/>
                  <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"/>
                </svg>
                {item.viewCount}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>
                </svg>
                {item.likeCount}
              </span>
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
