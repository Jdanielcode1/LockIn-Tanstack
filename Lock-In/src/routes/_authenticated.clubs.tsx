import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { useUser } from '../components/UserProvider'
import { CreateClubModal } from '../components/CreateClubModal'

export const Route = createFileRoute('/_authenticated/clubs')({
  component: ClubsLayout,
})

function ClubsLayout() {
  const matches = useMatches()
  const isChildRoute = matches.some(match => match.routeId === '/clubs/$clubId')

  if (isChildRoute) {
    return <Outlet />
  }

  return <ClubsList />
}

function ClubsList() {
  const { user } = useUser()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: clubs } = useSuspenseQuery(
    convexQuery(api.clubs.list, {
      limit: 50,
    })
  )

  const joinMutation = useMutation(api.clubs.join)
  const leaveMutation = useMutation(api.clubs.leave)

  const handleJoinClub = async (clubId: Id<'clubs'>) => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await joinMutation({
        // userId removed - backend gets it from ctx.auth
        clubId
      })
    } catch (error) {
      console.error('Error joining club:', error)
      alert('Failed to join club')
    }
  }

  const handleLeaveClub = async (clubId: Id<'clubs'>) => {
    if (!user) return

    try {
      await leaveMutation({
        // userId removed - backend gets it from ctx.auth
        clubId
      })
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

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#c9d1d9] mb-2">
              👥 Clubs
            </h1>
            <p className="text-[#8b949e]">
              Join communities and connect with others
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-md transition font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
            </svg>
            Create Club
          </button>
        </div>

        {/* Clubs Grid */}
        {clubs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club: any) => (
              <ClubCard
                key={club._id}
                club={club}
                user={user}
                onJoin={handleJoinClub}
                onLeave={handleLeaveClub}
                getTypeIcon={getTypeIcon}
                getTypeColor={getTypeColor}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-md">
            <div className="text-[#8b949e] text-6xl mb-4">👥</div>
            <h2 className="text-2xl font-semibold text-[#c9d1d9] mb-2">
              No clubs yet
            </h2>
            <p className="text-[#8b949e] mb-6 text-sm">
              Be the first to create a club for the community!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-block bg-[#238636] text-white px-4 py-2 rounded-md hover:bg-[#2ea043] transition text-sm font-medium"
            >
              Create Club
            </button>
          </div>
        )}
      </div>

      {/* Create Club Modal */}
      {showCreateModal && (
        <CreateClubModal onClose={() => setShowCreateModal(false)} />
      )}
    </main>
  )
}

function ClubCard({
  club,
  user,
  onJoin,
  onLeave,
  getTypeIcon,
  getTypeColor,
}: {
  club: any
  user: any
  onJoin: (id: Id<'clubs'>) => void
  onLeave: (id: Id<'clubs'>) => void
  getTypeIcon: (type: string) => string
  getTypeColor: (type: string) => string
}) {
  const { data: isMember } = useQuery({
    ...convexQuery(api.clubs.isMember, {
      clubId: club._id,
      userId: user?.userId || ('' as any),
    }),
    enabled: !!user,
  })

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition group">
      <Link
        to="/clubs/$clubId"
        params={{ clubId: club._id }}
        className="block"
      >
        {/* Header with gradient */}
        <div className={`h-24 bg-gradient-to-br ${getTypeColor(club.type)} flex items-center justify-center relative group-hover:scale-105 transition`}>
          <div className="text-5xl">{getTypeIcon(club.type)}</div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-[#c9d1d9] mb-2 line-clamp-2 group-hover:text-[#58a6ff] transition">
            {club.name}
          </h3>
          <p className="text-sm text-[#8b949e] mb-4 line-clamp-2">
            {club.description}
          </p>

          {/* Members */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-[#8b949e]">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
              </svg>
              <span>{club.memberCount} members</span>
            </div>
            <span className="text-xs bg-[#21262d] border border-[#30363d] px-2 py-1 rounded capitalize">
              {club.type}
            </span>
          </div>
        </div>
      </Link>

      {/* Action Button - Outside Link to prevent nested buttons */}
      <div className="p-4 pt-0">
        {isMember ? (
          <button
            onClick={(e) => {
              e.preventDefault()
              onLeave(club._id)
            }}
            className="w-full bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 rounded-md hover:bg-[#30363d] transition text-sm font-medium"
          >
            Leave Club
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.preventDefault()
              onJoin(club._id)
            }}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-md transition text-sm font-medium"
          >
            Join Club
          </button>
        )}
      </div>
    </div>
  )
}
