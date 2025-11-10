import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useUser } from './UserProvider'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

interface AllProjectsModalProps {
  onClose: () => void
}

export function AllProjectsModal({ onClose }: AllProjectsModalProps) {
  const { user } = useUser()
  const [cursor, setCursor] = useState<string | null>(null)

  const { data: projectsData } = useSuspenseQuery(
    convexQuery(api.projects.list, {
      userId: user?._id,
      paginationOpts: { numItems: 20, cursor },
    })
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'completed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getProgressPercentage = (completed: number, target: number) => {
    return Math.min((completed / target) * 100, 100)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#30363d] flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#c9d1d9]">All Projects</h2>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#c9d1d9] transition"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {projectsData.page.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-[#8b949e] text-5xl mb-4">📁</div>
              <p className="text-[#8b949e]">No projects yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectsData.page.map((project) => (
                <Link
                  key={project._id}
                  to="/projects/$projectId"
                  params={{ projectId: project._id }}
                  onClick={onClose}
                  className="bg-[#0d1117] border border-[#30363d] rounded-md p-4 hover:border-[#58a6ff] transition group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-[#c9d1d9] font-semibold group-hover:text-[#58a6ff] transition line-clamp-1">
                      {project.title}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded border ${getStatusColor(
                        project.status
                      )}`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#8b949e] mb-3 line-clamp-2">
                    {project.description}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#8b949e]">
                      <span>
                        {project.completedHours.toFixed(1)}h / {project.targetHours}h
                      </span>
                      <span>{getProgressPercentage(project.completedHours, project.targetHours).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-[#21262d] rounded-full h-1.5">
                      <div
                        className="bg-[#238636] h-1.5 rounded-full transition-all"
                        style={{
                          width: `${getProgressPercentage(
                            project.completedHours,
                            project.targetHours
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!projectsData.isDone && (
            <div className="text-center mt-6">
              <button
                onClick={() => setCursor(projectsData.continueCursor)}
                className="bg-[#21262d] border border-[#30363d] text-[#c9d1d9] px-4 py-2 rounded-md hover:bg-[#30363d] transition text-sm"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
