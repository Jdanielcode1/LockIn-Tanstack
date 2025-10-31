import { createFileRoute, useNavigate, Outlet, useMatches } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { ContributionHeatmap } from '../components/ContributionHeatmap'
import { CreateProjectModal } from '../components/CreateProjectModal'

export const Route = createFileRoute('/projects')({
  loader: async (opts) => {
    const currentYear = new Date().getFullYear()
    
    // Pre-fetch all data for faster client-side navigation
    await Promise.all([
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.projects.list, {
          paginationOpts: { numItems: 100, cursor: null },
        })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.stats.getOverallStats, {})
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.stats.getContributionData, { year: currentYear })
      ),
      opts.context.queryClient.ensureQueryData(
        convexQuery(api.stats.getActivityFeed, { limit: 15 })
      ),
    ])
  },
  component: ProjectsLayout,
})

function ProjectsLayout() {
  const matches = useMatches()
  const isDetailRoute = matches.some(match => match.routeId === '/projects/$projectId')
  
  if (isDetailRoute) {
    return <Outlet />
  }
  
  return <ProjectsList />
}

function ProjectsList() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()

  const { data: projectsData } = useSuspenseQuery(
    convexQuery(api.projects.list, {
      paginationOpts: { numItems: 100, cursor: null },
    })
  )

  const { data: stats } = useSuspenseQuery(
    convexQuery(api.stats.getOverallStats, {})
  )

  const { data: contributionData } = useSuspenseQuery(
    convexQuery(api.stats.getContributionData, { year: currentYear })
  )

  const { data: activityFeed } = useSuspenseQuery(
    convexQuery(api.stats.getActivityFeed, { limit: 15 })
  )

  const handleProjectClick = (projectId: string) => {
    navigate({ 
      to: '/projects/$projectId', 
      params: { projectId } 
    })
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        <div className="grid grid-cols-1 lg:grid-cols-[296px_1fr] gap-6">
          {/* Left Sidebar - Profile */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            {/* Avatar */}
            <div className="mb-4">
              <div className="w-[296px] h-[296px] rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-8xl font-bold border-2 border-[#30363d]">
                TC
              </div>
            </div>

            {/* Name and Username */}
            <div className="mb-4">
              <h1 className="text-2xl font-semibold text-[#c9d1d9] mb-1">
                Timelapse Creator
              </h1>
              <p className="text-xl text-[#8b949e] font-light">
                JdanielCode1
              </p>
            </div>

            {/* Edit Profile Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-4 py-2 rounded-md hover:bg-[#30363d] transition text-sm font-medium mb-4"
            >
              Edit profile
            </button>

            {/* Bio */}
            <div className="mb-4">
              <p className="text-base text-[#c9d1d9] mb-3">
                pushing to main
              </p>
              <p className="text-sm text-[#8b949e]">
                Building projects and sharing progress through timelapses
              </p>
            </div>

            {/* Followers */}
            <div className="flex items-center gap-1 text-sm text-[#8b949e] mb-4">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Z"/>
                </svg>
                <span className="font-semibold text-[#c9d1d9]">3</span> followers
              </span>
              <span>·</span>
              <span><span className="font-semibold text-[#c9d1d9]">12</span> following</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-[#8b949e] mb-4">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="m12.166 8.94-.93 1.465A3.5 3.5 0 0 1 8.5 12.023V13a.75.75 0 0 1-1.5 0v-.977a3.5 3.5 0 0 1-2.736-1.618l-.93-1.465a.75.75 0 0 1 1.192-.786l.93 1.465a2 2 0 0 0 3.088 0l.93-1.465a.75.75 0 1 1 1.192.786ZM8 7a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 7Z"/>
              </svg>
              <span>Berkeley</span>
            </div>

            {/* Stats - Compact */}
            <div className="border-t border-[#30363d] pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Projects</span>
                <span className="text-[#c9d1d9] font-semibold">{stats.totalProjects}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Hours</span>
                <span className="text-[#c9d1d9] font-semibold">{stats.totalHours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Uploads</span>
                <span className="text-[#c9d1d9] font-semibold">{stats.totalTimelapses}</span>
              </div>
            </div>
          </aside>

          {/* Right Content Area */}
          <div className="lg:col-start-2">{/* Popular Repositories Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base text-[#c9d1d9]">Popular repositories</h2>
              <button className="text-xs text-[#58a6ff] hover:underline">
                Customize your pins
              </button>
            </div>

            {/* Pinned Projects Grid */}
            {projectsData.page.length === 0 ? (
              <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-md">
                <div className="text-gray-500 text-6xl mb-4">📁</div>
                <h2 className="text-xl font-semibold text-[#c9d1d9] mb-2">
                  No projects yet
                </h2>
                <p className="text-[#8b949e] mb-6 text-sm">
                  Create your first project and start tracking progress!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {projectsData.page.slice(0, 6).map((project) => (
                  <div
                    key={project._id}
                    onClick={() => handleProjectClick(project._id)}
                    className="bg-[#161b22] border border-[#30363d] rounded-md p-4 hover:border-[#8b949e] transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/>
                        </svg>
                        <h3 className="text-[#58a6ff] text-sm font-semibold hover:underline">
                          {project.title}
                        </h3>
                      </div>
                      <span className="px-1.5 py-0.5 text-xs font-medium text-[#8b949e] border border-[#30363d] rounded-full">
                        Public
                      </span>
                    </div>
                    
                    <p className="text-xs text-[#8b949e] mb-3 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-[#8b949e]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-[#f1e05a]"></span>
                        <span>Progress</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
                        </svg>
                        {project.completedHours.toFixed(1)}h / {project.targetHours}h
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contribution Graph */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base text-[#c9d1d9]">
                  {contributionData.reduce((sum, d) => sum + d.count, 0)} contributions in the last year
                </h2>
                <select className="bg-transparent border border-[#30363d] text-[#8b949e] px-2 py-1 rounded text-xs hover:border-[#8b949e] transition">
                  <option>{currentYear}</option>
                  <option>{currentYear - 1}</option>
                </select>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-md p-4">
                <ContributionHeatmap data={contributionData} year={currentYear} />
              </div>
            </div>

            {/* Contribution Activity */}
            <div>
              <h2 className="text-base text-[#c9d1d9] mb-3">Contribution activity</h2>
              <div className="border border-[#30363d] rounded-md">
                <div className="bg-[#161b22] px-4 py-3 border-b border-[#30363d]">
                  <h3 className="text-sm font-semibold text-[#c9d1d9]">
                    October {currentYear}
                  </h3>
                </div>
                <div className="bg-[#0d1117] px-4 py-3">
                  {activityFeed.length === 0 ? (
                    <p className="text-sm text-[#8b949e]">No activity this month</p>
                  ) : (
                    <div className="space-y-4">
                      {activityFeed.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            activity.type === 'project_completed' ? 'bg-[#3fb950]' :
                            activity.type === 'timelapse_uploaded' ? 'bg-[#58a6ff]' :
                            'bg-[#8b949e]'
                          }`}></div>
                          <div className="flex-1 min-w-0 pb-4 border-b border-[#21262d] last:border-0">
                            <p className="text-sm text-[#c9d1d9]">
                              {activity.type === 'project_created' && 'Created project '}
                              {activity.type === 'timelapse_uploaded' && 'Uploaded timelapse to '}
                              {activity.type === 'project_completed' && 'Completed project '}
                              <span className="text-[#58a6ff] font-semibold hover:underline cursor-pointer">
                                {activity.projectTitle}
                              </span>
                            </p>
                            {activity.details && (
                              <p className="text-xs text-[#8b949e] mt-1">{activity.details}</p>
                            )}
                            <p className="text-xs text-[#8b949e] mt-1">
                              {new Date(activity.timestamp).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showCreateModal && (
          <CreateProjectModal onClose={() => setShowCreateModal(false)} />
        )}
      </div>
    </main>
  )
}
