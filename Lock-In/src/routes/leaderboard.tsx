import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'

export const Route = createFileRoute('/leaderboard')({
  loader: async (opts) => {
    // Pre-load default period (week)
    await opts.context.queryClient.ensureQueryData(
      convexQuery(api.leaderboard.getLeaderboard, {
        period: 'week',
        limit: 20,
      })
    )
  },
  component: Leaderboard,
})

type Period = 'day' | 'week' | 'month' | 'year'

function Leaderboard() {
  const [period, setPeriod] = useState<Period>('week')

  const { data: leaderboard, isLoading } = useQuery(
    convexQuery(api.leaderboard.getLeaderboard, {
      period,
      limit: 20,
    })
  )

  const periodLabels = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1000px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#c9d1d9] mb-2">
            🏆 Leaderboard
          </h1>
          <p className="text-[#8b949e]">
            Top creators ranked by total hours worked
          </p>
        </div>

        {/* Period Tabs */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md mb-6 p-1 flex gap-1">
          {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 px-4 py-2 rounded text-sm font-medium transition ${
                period === p
                  ? 'bg-[#238636] text-white'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin text-4xl mb-4 inline-block">⏳</div>
              <p className="text-[#8b949e]">Loading rankings...</p>
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-[#8b949e] text-6xl mb-4">📊</div>
              <h2 className="text-xl font-semibold text-[#c9d1d9] mb-2">
                No data for this period
              </h2>
              <p className="text-[#8b949e] text-sm">
                Be the first to upload a timelapse!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#30363d]">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 p-4 transition hover:bg-[#0d1117] ${
                    index < 3 ? 'bg-[#0d1117]/50' : ''
                  }`}
                >
                  {/* Rank */}
                  <div className="w-12 flex-shrink-0 text-center">
                    {index === 0 && (
                      <div className="text-3xl">🥇</div>
                    )}
                    {index === 1 && (
                      <div className="text-3xl">🥈</div>
                    )}
                    {index === 2 && (
                      <div className="text-3xl">🥉</div>
                    )}
                    {index > 2 && (
                      <div className="text-lg font-bold text-[#8b949e]">
                        #{entry.rank}
                      </div>
                    )}
                  </div>

                  {/* Avatar & Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar
                      avatarKey={entry.avatarKey}
                      displayName={entry.displayName}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="text-[#c9d1d9] font-semibold truncate">
                        {entry.displayName}
                      </div>
                      <div className="text-sm text-[#8b949e] truncate">
                        @{entry.username}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-[#c9d1d9] font-bold text-xl">
                        {entry.totalHours}h
                      </div>
                      <div className="text-[#8b949e] text-xs">total time</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#8b949e] font-semibold text-sm">
                        {entry.uploadCount}
                      </div>
                      <div className="text-[#8b949e] text-xs">
                        {entry.uploadCount === 1 ? 'upload' : 'uploads'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-[#161b22] border border-[#30363d] rounded-md p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="text-sm font-semibold text-[#c9d1d9] mb-1">
                How rankings work
              </h3>
              <p className="text-xs text-[#8b949e]">
                Rankings are based on total hours worked in the selected period.
                In case of a tie, the number of timelapse uploads is used as a tiebreaker.
                Keep working and uploading to climb the leaderboard!
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
