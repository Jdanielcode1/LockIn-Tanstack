import { Link, createFileRoute, useNavigate, Outlet, useMatches } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'

export const Route = createFileRoute('/projects')({
  component: ProjectsLayout,
})

function ProjectsLayout() {
  const matches = useMatches()
  const isDetailRoute = matches.some(match => match.routeId === '/projects/$projectId')
  
  // If we're on a detail route, just render the outlet
  if (isDetailRoute) {
    return <Outlet />
  }
  
  // Otherwise render the projects list
  return <ProjectsList />
}

function ProjectsList() {
  const [cursor, setCursor] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  const { data: projectsData } = useSuspenseQuery(
    convexQuery(api.projects.list, {
      paginationOpts: { numItems: 10, cursor: cursor },
    })
  )

  const handleProjectClick = (projectId: string) => {
    console.log('🔍 Attempting to navigate to project:', projectId)
    console.log('Current URL:', window.location.href)
    try {
      navigate({ 
        to: '/projects/$projectId', 
        params: { projectId } 
      })
      console.log('✅ Navigation call succeeded')
      
      // Check URL after navigation attempt
      setTimeout(() => {
        console.log('URL after navigation:', window.location.href)
      }, 100)
    } catch (error) {
      console.error('❌ Navigation error:', error)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              My Projects
            </h1>
            <p className="text-gray-600">
              Track your progress and share timelapses
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            + Create Project
          </button>
        </div>

        {projectsData.page.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📁</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              No projects yet
            </h2>
            <p className="text-gray-500 mb-6">
              Create your first project and start tracking progress!
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {projectsData.page.map((project) => (
                <div
                  key={project._id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {project.title}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {project.description}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        project.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'active'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>
                        {project.completedHours.toFixed(1)} /{' '}
                        {project.targetHours} hours
                      </span>
                      <span>
                        {Math.round(
                          (project.completedHours / project.targetHours) * 100
                        )}
                        %
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (project.completedHours / project.targetHours) *
                              100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={() => handleProjectClick(project._id)}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-semibold"
                      >
                        Open Project
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!projectsData.isDone && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setCursor(projectsData.continueCursor)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}

        {showCreateModal && (
          <CreateProjectModal onClose={() => setShowCreateModal(false)} />
        )}
      </div>
    </main>
  )
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetHours, setTargetHours] = useState('')
  const createProject = useMutation(api.projects.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createProject({
      title,
      description,
      targetHours: parseFloat(targetHours),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Hours
            </label>
            <input
              type="number"
              step="0.5"
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min="0.5"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition font-semibold"
            >
              Create
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
