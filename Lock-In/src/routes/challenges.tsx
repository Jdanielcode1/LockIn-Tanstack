import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { useUser } from '../components/UserProvider'
import { CreateChallengeModal } from '../components/CreateChallengeModal'

export const Route = createFileRoute('/challenges')({
  component: ChallengesLayout,
})

function ChallengesLayout() {
  const matches = useMatches()
  const isChildRoute = matches.some(match => match.routeId === '/challenges/$challengeId')

  if (isChildRoute) {
    return <Outlet />
  }

  return <ChallengesList />
}

function ChallengesList() {
  const { user } = useUser()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: challengesData } = useSuspenseQuery(
    convexQuery(api.challenges.list, {
      paginationOpts: { numItems: 50, cursor: null },
    })
  )

  const joinMutation = useMutation(api.challenges.join)
  const leaveMutation = useMutation(api.challenges.leave)

  const handleJoinChallenge = async (challengeId: Id<'challenges'>) => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await joinMutation({ challengeId, userId: user.userId })
    } catch (error) {
      console.error('Error joining challenge:', error)
      alert('Failed to join challenge')
    }
  }

  const handleLeaveChallenge = async (challengeId: Id<'challenges'>) => {
    if (!user) return

    try {
      await leaveMutation({ challengeId, userId: user.userId })
    } catch (error) {
      console.error('Error leaving challenge:', error)
      alert('Failed to leave challenge')
    }
  }

  const getChallengeStatus = (startDate: number, endDate: number) => {
    const now = Date.now()
    if (now < startDate) return 'upcoming'
    if (now > endDate) return 'completed'
    return 'active'
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'reading':
        return 'from-blue-500 to-indigo-600'
      case 'study':
        return 'from-purple-500 to-pink-600'
      case 'workout':
        return 'from-orange-500 to-red-600'
      default:
        return 'from-green-500 to-teal-600'
    }
  }

  const activeChallenges = challengesData.page.filter(
    (c: any) => getChallengeStatus(c.startDate, c.endDate) === 'active'
  )
  const upcomingChallenges = challengesData.page.filter(
    (c: any) => getChallengeStatus(c.startDate, c.endDate) === 'upcoming'
  )
  const completedChallenges = challengesData.page.filter(
    (c: any) => getChallengeStatus(c.startDate, c.endDate) === 'completed'
  )

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#c9d1d9] mb-2">
              🎯 Challenges
            </h1>
            <p className="text-[#8b949e]">
              Join challenges and compete with the community
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md transition font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
            </svg>
            Create Challenge
          </button>
        </div>

        {/* Active Challenges */}
        {activeChallenges.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#c9d1d9] mb-4">
              Active Challenges
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeChallenges.map((challenge: any) => (
                <ChallengeCard
                  key={challenge._id}
                  challenge={challenge}
                  user={user}
                  onJoin={handleJoinChallenge}
                  onLeave={handleLeaveChallenge}
                  getTypeIcon={getTypeIcon}
                  getTypeColor={getTypeColor}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Challenges */}
        {upcomingChallenges.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#c9d1d9] mb-4">
              Upcoming Challenges
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingChallenges.map((challenge: any) => (
                <ChallengeCard
                  key={challenge._id}
                  challenge={challenge}
                  user={user}
                  onJoin={handleJoinChallenge}
                  onLeave={handleLeaveChallenge}
                  getTypeIcon={getTypeIcon}
                  getTypeColor={getTypeColor}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Challenges */}
        {completedChallenges.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#c9d1d9] mb-4">
              Completed Challenges
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedChallenges.map((challenge: any) => (
                <ChallengeCard
                  key={challenge._id}
                  challenge={challenge}
                  user={user}
                  onJoin={handleJoinChallenge}
                  onLeave={handleLeaveChallenge}
                  getTypeIcon={getTypeIcon}
                  getTypeColor={getTypeColor}
                  isCompleted
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {challengesData.page.length === 0 && (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-md">
            <div className="text-[#8b949e] text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-semibold text-[#c9d1d9] mb-2">
              No challenges yet
            </h2>
            <p className="text-[#8b949e] mb-6 text-sm">
              Be the first to create a challenge for the community!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-block bg-[#238636] text-white px-4 py-2 rounded-md hover:bg-[#2ea043] transition text-sm font-medium"
            >
              Create Challenge
            </button>
          </div>
        )}

        {/* Create Challenge Modal */}
        {showCreateModal && (
          <CreateChallengeModal onClose={() => setShowCreateModal(false)} />
        )}
      </div>
    </main>
  )
}

function ChallengeCard({
  challenge,
  user,
  onJoin,
  onLeave,
  getTypeIcon,
  getTypeColor,
  isCompleted = false,
}: {
  challenge: any
  user: any
  onJoin: (id: Id<'challenges'>) => void
  onLeave: (id: Id<'challenges'>) => void
  getTypeIcon: (type: string) => string
  getTypeColor: (type: string) => string
  isCompleted?: boolean
}) {
  const { data: isParticipating } = useQuery({
    ...convexQuery(api.challenges.isParticipating, {
      challengeId: challenge._id,
      userId: user?.userId || ('' as any),
    }),
    enabled: !!user,
  })

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition group">
      <Link
        to="/challenges/$challengeId"
        params={{ challengeId: challenge._id }}
        className="block"
      >
        {/* Header with gradient */}
        <div className={`h-24 bg-gradient-to-br ${getTypeColor(challenge.type)} flex items-center justify-center relative group-hover:scale-105 transition`}>
          <div className="text-5xl">{getTypeIcon(challenge.type)}</div>
          {isCompleted && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              Completed
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-[#c9d1d9] mb-2 line-clamp-2 group-hover:text-[#58a6ff] transition">
            {challenge.title}
          </h3>
          <p className="text-sm text-[#8b949e] mb-4 line-clamp-2">
            {challenge.description}
          </p>

          {challenge.goal && (
            <div className="mb-4 p-2 bg-[#0d1117] rounded border border-[#30363d]">
              <div className="text-xs text-[#8b949e] mb-1">Goal</div>
              <div className="text-sm text-[#c9d1d9] font-semibold">
                {challenge.goal}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-2 mb-4 text-xs text-[#8b949e]">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM1 3.857C1 3.384 1.448 3 2 3h12c.552 0 1 .384 1 .857v10.286c0 .473-.448.857-1 .857H2c-.552 0-1-.384-1-.857V3.857z"/>
              <path d="M6.5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-9 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            </svg>
            <span>
              {new Date(challenge.startDate).toLocaleDateString()} -{' '}
              {new Date(challenge.endDate).toLocaleDateString()}
            </span>
          </div>

          {/* Participants */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-[#8b949e]">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
              </svg>
              <span>{challenge.participantCount} joined</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Action Button - Outside Link to prevent nested buttons */}
      {!isCompleted && (
        <div className="p-4 pt-0">
          {isParticipating ? (
            <button
              onClick={(e) => {
                e.preventDefault()
                onLeave(challenge._id)
              }}
              className="w-full bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 rounded-md hover:bg-[#30363d] transition text-sm font-medium"
            >
              Leave Challenge
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault()
                onJoin(challenge._id)
              }}
              className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-md transition text-sm font-medium"
            >
              Join Challenge
            </button>
          )}
        </div>
      )}
    </div>
  )
}
