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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700">
            Project not found
          </h2>
          <Link
            to="/projects"
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject({ projectId: projectId as Id<'projects'> })
      window.location.href = '/projects'
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/projects"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to Projects
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {project.title}
              </h1>
              <p className="text-gray-600">{project.description}</p>
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
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span className="font-semibold">Progress</span>
                <span>
                  {project.completedHours.toFixed(1)} / {project.targetHours}{' '}
                  hours (
                  {Math.round(
                    (project.completedHours / project.targetHours) * 100
                  )}
                  %)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      (project.completedHours / project.targetHours) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Total Timelapses</p>
                <p className="text-2xl font-bold">{project.timelapseCount}</p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                + Upload Timelapse
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Timelapses</h2>
        </div>

        {timelapses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg">
            <div className="text-gray-400 text-6xl mb-4">📹</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No timelapses yet
            </h3>
            <p className="text-gray-500">
              Upload your first timelapse to track progress
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {timelapses.map((timelapse) => (
              <Link
                key={timelapse._id}
                to="/timelapse/$timelapseId"
                params={{ timelapseId: timelapse._id }}
                className="group"
              >
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                  <div className="aspect-video bg-gray-200 flex items-center justify-center">
                    <div className="text-gray-400 text-6xl">▶️</div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      {timelapse.durationMinutes} minutes
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>👁️ {timelapse.viewCount}</span>
                      <span>❤️ {timelapse.likeCount}</span>
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
