import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'

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
  const [cursor, setCursor] = useState<string | null>(null)
  
  const { data: feedData } = useSuspenseQuery(
    convexQuery(api.timelapses.listFeed, {
      paginationOpts: { numItems: 10, cursor: cursor },
    })
  )

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.stats.getOverallStats, {})
  )

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
      <div className="container mx-auto px-4 py-6 max-w-[1280px]">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              {/* Profile Card */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <div className="flex flex-col items-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mb-3">
                    TC
                  </div>
                  <h2 className="text-lg font-semibold text-[#c9d1d9]">Timelapse Creator</h2>
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

              {/* Latest Activity */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <h3 className="text-sm font-semibold text-[#c9d1d9] mb-3">Latest Activity</h3>
                {feedData.page.length > 0 ? (
                  <div>
                    <p className="text-sm text-[#c9d1d9] font-medium mb-1">
                      {feedData.page[0].projectTitle}
                    </p>
                    <p className="text-xs text-[#8b949e]">
                      {getRelativeTime(feedData.page[0].uploadedAt)}
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

              {/* Quick Actions */}
              <Link
                to="/projects"
                className="block bg-[#238636] hover:bg-[#2ea043] text-white text-center py-2 rounded-md transition text-sm font-medium"
              >
                + New Project
              </Link>
            </div>
          </aside>

          {/* Main Feed */}
          <div>
        {feedData.page.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-md">
            <div className="text-[#8b949e] text-6xl mb-4">📹</div>
            <h2 className="text-2xl font-semibold text-[#c9d1d9] mb-2">
              No activities yet
            </h2>
            <p className="text-[#8b949e] mb-6 text-sm">
              Be the first to share your project progress!
            </p>
            <Link
              to="/projects"
              className="inline-block bg-[#238636] text-white px-4 py-2 rounded-md hover:bg-[#2ea043] transition text-sm font-medium"
            >
              Create a Project
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {feedData.page.map((timelapse) => (
                <article
                  key={timelapse._id}
                  className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition"
                >
                  {/* Activity Header */}
                  <div className="p-4 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      TC
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[#c9d1d9] font-semibold text-sm">
                          Timelapse Creator
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

                  {/* Video Preview */}
                  <Link
                    to="/timelapse/$timelapseId"
                    params={{ timelapseId: timelapse._id }}
                  >
                    <div className="aspect-video bg-[#0d1117] flex items-center justify-center border-y border-[#30363d] hover:bg-[#161b22] transition">
                      <svg className="w-16 h-16 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                        <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                      </svg>
                    </div>
                  </Link>

                  {/* Interaction Footer */}
                  <div className="p-4">
                    <div className="flex items-center gap-4 text-sm">
                      <button className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#f85149] transition">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>
                        </svg>
                        <span>{timelapse.likeCount}</span>
                      </button>
                      <button className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#58a6ff] transition">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v8a1.5 1.5 0 0 1-1.5 1.5h-3.25a.75.75 0 0 0-.53.22L8 15.44l-1.72-1.72a.75.75 0 0 0-.53-.22H2.5A1.5 1.5 0 0 1 1 11.5v-8Zm1.5-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h3.5c.28 0 .549.11.75.31L8 13.56l1.75-1.75c.2-.2.47-.31.75-.31h3.5a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-11Z"/>
                        </svg>
                        <span>0</span>
                      </button>
                      <div className="flex items-center gap-1.5 text-[#8b949e] ml-auto">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8ZM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8Z"/>
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"/>
                        </svg>
                        <span>{timelapse.viewCount}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {!feedData.isDone && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setCursor(feedData.continueCursor)}
                  className="bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-4 py-2 rounded-md hover:bg-[#30363d] transition text-sm font-medium"
                >
                  Show more activities
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </main>
  )
}
