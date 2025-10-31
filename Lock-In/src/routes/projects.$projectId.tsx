import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { VideoUpload } from '../components/VideoUpload'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetail,
})

function ProjectDetail() {
  const { projectId } = Route.useParams()
  const [showUploadModal, setShowUploadModal] = useState(false)

  console.log('🎯 ProjectDetail component rendered with projectId:', projectId)

  const { data: project } = useSuspenseQuery(
    convexQuery(api.projects.get, { projectId: projectId as Id<'projects'> })
  )

  console.log('📊 Project data loaded:', project)

  const { data: timelapses } = useSuspenseQuery(
    convexQuery(api.timelapses.listByProject, {
      projectId: projectId as Id<'projects'>,
    })
  )

  const updateStatus = useMutation(api.projects.updateStatus)
  const deleteProject = useMutation(api.projects.deleteProject)

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#c9d1d9]">
            Project not found
          </h2>
          <Link
            to="/projects"
            className="text-[#58a6ff] hover:underline mt-4 inline-block"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'completed':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default:
        return 'bg-[#8b949e]/10 text-[#8b949e] border-[#8b949e]/20'
    }
  }

  const progressPercentage = Math.min(
    (project.completedHours / project.targetHours) * 100,
    100
  )

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject({ projectId: projectId as Id<'projects'> })
      window.location.href = '/projects'
    }
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        <Link
          to="/projects"
          className="text-[#58a6ff] hover:underline mb-6 inline-flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"/>
          </svg>
          Back to Projects
        </Link>

        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-[#c9d1d9]">
                  {project.title}
                </h1>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(project.status)}`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
              </div>
              <p className="text-[#8b949e] text-base">{project.description}</p>
              {project.user && (
                <div className="flex items-center gap-2 mt-3 text-sm text-[#8b949e]">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                    <path d="M8 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM6.5 8a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V8Z"/>
                  </svg>
                  <span>Created by <span className="text-[#c9d1d9]">{project.user.displayName}</span></span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={project.status}
                onChange={(e) =>
                  updateStatus({
                    projectId: projectId as Id<'projects'>,
                    status: e.target.value as any,
                  })
                }
                className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] rounded-md hover:border-[#8b949e] focus:ring-2 focus:ring-[#58a6ff] focus:border-[#58a6ff] transition text-sm"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600/10 border border-red-600/20 text-red-400 rounded-md hover:bg-red-600/20 transition text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-[#c9d1d9]">Progress</span>
                <span className="text-[#8b949e]">
                  <span className="text-[#c9d1d9] font-medium">{project.completedHours.toFixed(1)}h</span> / {project.targetHours}h
                  <span className="ml-2 text-[#58a6ff]">({progressPercentage.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="w-full bg-[#21262d] rounded-full h-2">
                <div
                  className="bg-[#238636] h-2 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#30363d]">
              <div>
                <p className="text-sm text-[#8b949e] mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                    <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                  </svg>
                  Total Timelapses
                </p>
                <p className="text-2xl font-bold text-[#c9d1d9]">{project.timelapseCount}</p>
              </div>
              <div>
                <p className="text-sm text-[#8b949e] mb-1 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                  </svg>
                  Time Logged
                </p>
                <p className="text-2xl font-bold text-[#c9d1d9]">{project.completedHours.toFixed(1)}h</p>
              </div>
              <div className="flex items-end justify-end">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-[#238636] hover:bg-[#2ea043] text-white px-6 py-2.5 rounded-md transition font-medium text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
                  </svg>
                  Upload Timelapse
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#c9d1d9]">Timelapses</h2>
        </div>

        {timelapses.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] border border-[#30363d] rounded-md">
            <div className="text-[#8b949e] text-6xl mb-4">📹</div>
            <h3 className="text-xl font-semibold text-[#c9d1d9] mb-2">
              No timelapses yet
            </h3>
            <p className="text-[#8b949e]">
              Upload your first timelapse to track progress
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timelapses.map((timelapse) => (
              <Link
                key={timelapse._id}
                to="/timelapse/$timelapseId"
                params={{ timelapseId: timelapse._id }}
                className="group"
              >
                <div className="bg-[#161b22] border border-[#30363d] rounded-md overflow-hidden hover:border-[#8b949e] transition">
                  <div className="aspect-video bg-[#0d1117] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10"></div>
                    <svg className="w-16 h-16 text-[#8b949e] relative z-10 group-hover:text-[#58a6ff] transition" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                      <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                    </svg>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3 text-sm text-[#8b949e]">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                      </svg>
                      <span className="text-[#c9d1d9]">{timelapse.durationMinutes} minutes</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#8b949e]">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8ZM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8Z"/>
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"/>
                        </svg>
                        {timelapse.viewCount}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                          <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>
                        </svg>
                        {timelapse.likeCount}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {showUploadModal && (
          <VideoUpload
            projectId={projectId as Id<'projects'>}
            onComplete={() => setShowUploadModal(false)}
            onCancel={() => setShowUploadModal(false)}
          />
        )}
      </div>
    </main>
  )
}
