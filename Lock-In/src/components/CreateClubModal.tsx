import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useUser } from './UserProvider'

interface CreateClubModalProps {
  onClose: () => void
}

export function CreateClubModal({ onClose }: CreateClubModalProps) {
  const { user } = useUser()
  const createClub = useMutation(api.clubs.create)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'coding' | 'study' | 'fitness' | 'general'>('general')
  const [isPublic, setIsPublic] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      alert('Please set up your profile first')
      return
    }

    if (!name.trim() || !description.trim()) {
      alert('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      await createClub({
        // creatorId removed - backend gets it from ctx.auth
        name: name.trim(),
        description: description.trim(),
        type,
        isPublic,
      })

      alert('Club created successfully!')
      onClose()
    } catch (error) {
      console.error('Error creating club:', error)
      alert('Failed to create club. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-[#161b22] rounded-md max-w-2xl w-full border border-[#30363d]">
        {/* Header */}
        <div className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#c9d1d9]">Create Club</h2>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#c9d1d9] transition"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Club Name <span className="text-[#f85149]">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
              placeholder="e.g., Web Developers Club"
            />
            <p className="text-xs text-[#8b949e] mt-1">{name.length}/100 characters</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Description <span className="text-[#f85149]">*</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              required
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none resize-none"
              placeholder="Describe what your club is about..."
            />
            <p className="text-xs text-[#8b949e] mt-1">{description.length}/500 characters</p>
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Club Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] focus:border-[#58a6ff] focus:outline-none"
            >
              <option value="general">👥 General</option>
              <option value="coding">💻 Coding</option>
              <option value="study">📚 Study</option>
              <option value="fitness">💪 Fitness</option>
            </select>
          </div>

          {/* Privacy */}
          <div>
            <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Privacy
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="privacy"
                  checked={isPublic}
                  onChange={() => setIsPublic(true)}
                  className="w-4 h-4 text-[#238636] bg-[#0d1117] border-[#30363d] focus:ring-[#238636] focus:ring-2"
                />
                <span className="text-sm text-[#c9d1d9]">Public - Anyone can join</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="privacy"
                  checked={!isPublic}
                  onChange={() => setIsPublic(false)}
                  className="w-4 h-4 text-[#238636] bg-[#0d1117] border-[#30363d] focus:ring-[#238636] focus:ring-2"
                />
                <span className="text-sm text-[#c9d1d9]">Private - Invite only</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#30363d]">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2 px-4 rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Club'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 px-4 rounded-md hover:bg-[#30363d] transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
