import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useUser } from './UserProvider'

interface CreateProjectModalProps {
  onClose: () => void
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const { user } = useUser()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetHours, setTargetHours] = useState('')
  const [creating, setCreating] = useState(false)

  const createProject = useMutation(api.projects.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !description || !targetHours || !user) return

    setCreating(true)

    try {
      await createProject({
        // userId removed - backend gets it from ctx.auth
        title,
        description,
        targetHours: parseFloat(targetHours),
      })

      onClose()
    } catch (error) {
      console.error('Create project error:', error)
      alert('Failed to create project. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="My Awesome Project"
              required
              disabled={creating}
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Describe your project..."
              required
              disabled={creating}
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Hours
            </label>
            <input
              type="number"
              step="0.5"
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="100"
              required
              min="0.5"
              disabled={creating}
            />
            <p className="text-xs text-gray-500 mt-1">
              How many hours do you plan to spend on this project?
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={creating || !title || !description || !targetHours}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-md hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="flex-1 bg-gray-700 border border-gray-600 text-gray-300 py-2.5 rounded-md hover:bg-gray-600 transition font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

