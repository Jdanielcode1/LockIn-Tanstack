import { Link } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useMutation } from 'convex/react'
import { useUser } from './UserProvider'
import { Avatar } from './Avatar'
import type { Id } from '../../convex/_generated/dataModel'

export function RightSidebar() {
  const { user } = useUser()

  // Fetch challenges
  const { data: challengesData } = useSuspenseQuery(
    convexQuery(api.challenges.list, {
      paginationOpts: { numItems: 3, cursor: null },
    })
  )

  // Fetch clubs
  const { data: clubs } = useSuspenseQuery(
    convexQuery(api.clubs.list, { limit: 3 })
  )

  // Fetch suggested friends (only if user is logged in)
  const { data: suggestedFriends } = useQuery({
    ...convexQuery(api.follows.getSuggestedUsers, {
      userId: user?.userId!,
      limit: 3,
    }),
    enabled: !!user,
  })

  const followMutation = useMutation(api.follows.follow)
  const joinChallengeMutation = useMutation(api.challenges.join)
  const joinClubMutation = useMutation(api.clubs.join)

  const handleFollow = async (userId: Id<'users'>) => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await followMutation({
        followerId: user.userId,
        followingId: userId,
      })
    } catch (error) {
      console.error('Error following user:', error)
    }
  }

  const handleJoinChallenge = async (challengeId: Id<'challenges'>) => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await joinChallengeMutation({
        challengeId,
        userId: user.userId,
      })
    } catch (error) {
      console.error('Error joining challenge:', error)
    }
  }

  const handleJoinClub = async (clubId: Id<'clubs'>) => {
    if (!user) {
      alert('Please set up your profile first')
      return
    }

    try {
      await joinClubMutation({
        clubId,
        userId: user.userId,
      })
    } catch (error) {
      console.error('Error joining club:', error)
    }
  }

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-6 space-y-4">
        {/* Challenges Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2.5 0a.5.5 0 0 1 .5.5V2h10.5a.5.5 0 0 1 0 1H3v10.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 .5-.5Z"/>
                <path d="M15.854 5.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L8 11.293l6.646-6.647a.5.5 0 0 1 .708 0Z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#c9d1d9]">Challenges</h3>
              <p className="text-xs text-[#8b949e]">Push yourself further</p>
            </div>
          </div>

          {challengesData.page.length > 0 ? (
            <div className="space-y-3">
              {challengesData.page.slice(0, 2).map((challenge: any) => (
                <div key={challenge._id} className="p-2 rounded hover:bg-[#0d1117] transition">
                  <h4 className="text-sm font-medium text-[#c9d1d9] mb-1">{challenge.title}</h4>
                  <p className="text-xs text-[#8b949e] mb-2 line-clamp-2">{challenge.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#8b949e]">{challenge.participantCount} participants</span>
                    <button
                      onClick={() => handleJoinChallenge(challenge._id)}
                      className="text-xs bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-3 py-1.5 rounded hover:bg-[#30363d] hover:border-[#8b949e] transition font-medium"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8b949e] text-center py-3">No active challenges</p>
          )}

          <Link
            to="/challenges"
            className="block mt-3 text-sm text-center text-[#c9d1d9] hover:text-white transition font-medium bg-[#21262d] border border-[#30363d] rounded-md py-2 hover:border-[#8b949e]"
          >
            View All Challenges →
          </Link>
        </div>

        {/* Clubs Card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8Zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022ZM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816ZM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#c9d1d9]">Clubs</h3>
              <p className="text-xs text-[#8b949e]">Join communities</p>
            </div>
          </div>

          {clubs.length > 0 ? (
            <div className="space-y-3">
              {clubs.map((club) => (
                <div key={club._id} className="p-2 rounded hover:bg-[#0d1117] transition">
                  <h4 className="text-sm font-medium text-[#c9d1d9] mb-1">{club.name}</h4>
                  <p className="text-xs text-[#8b949e] mb-2 line-clamp-2">{club.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#8b949e]">{club.memberCount} members</span>
                    <button
                      onClick={() => handleJoinClub(club._id)}
                      className="text-xs bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-3 py-1.5 rounded hover:bg-[#30363d] hover:border-[#8b949e] transition font-medium"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8b949e] text-center py-3">No clubs available</p>
          )}

          <Link
            to="/clubs"
            className="block w-full mt-3 text-sm text-center text-[#c9d1d9] hover:text-white transition font-medium bg-[#21262d] border border-[#30363d] rounded-md py-2 hover:border-[#8b949e]"
          >
            View All Clubs →
          </Link>
        </div>

        {/* Suggested Friends Card */}
        {user && suggestedFriends && suggestedFriends.length > 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
            <h3 className="text-sm font-semibold text-[#c9d1d9] mb-4">Suggested Friends</h3>

            <div className="space-y-3">
              {suggestedFriends.map((friend) => (
                <div key={friend._id} className="flex items-start gap-2">
                  <Avatar
                    avatarKey={friend.avatarKey}
                    displayName={friend.displayName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#c9d1d9] truncate">
                      {friend.displayName}
                    </p>
                    {friend.location && (
                      <p className="text-xs text-[#8b949e] truncate">{friend.location}</p>
                    )}
                    {friend.mutualFollowersCount > 0 ? (
                      <p className="text-xs text-[#8b949e]">
                        {friend.mutualFollowersCount} mutual connection{friend.mutualFollowersCount > 1 ? 's' : ''}
                      </p>
                    ) : friend.isActive ? (
                      <p className="text-xs text-[#238636]">Active on Lock-In</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleFollow(friend._id)}
                    className="text-xs bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-3 py-1.5 rounded hover:bg-[#30363d] hover:border-[#8b949e] transition font-medium flex-shrink-0"
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>

            <button className="w-full mt-3 text-sm text-center text-[#c9d1d9] hover:text-white transition font-medium bg-[#21262d] border border-[#30363d] rounded-md py-2 hover:border-[#8b949e]">
              Find More Friends →
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
