import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useUser } from './UserProvider'
import type { Id } from '../../convex/_generated/dataModel'

interface CreateChallengeModalProps {
  onClose: () => void
  clubId?: Id<'clubs'> // Optional: if provided, creates a club-specific challenge
  clubName?: string // Optional: club name to display in modal
}

export function CreateChallengeModal({ onClose, clubId, clubName }: CreateChallengeModalProps) {
  const { user } = useUser()
  const createChallenge = useMutation(api.challenges.create)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'reading' | 'study' | 'workout' | 'custom'>('study')
  const [goal, setGoal] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      alert('Please set up your profile first')
      return
    }

    if (!title.trim() || !description.trim() || !startDate || !endDate) {
      alert('Please fill in all required fields')
      return
    }

    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()

    if (end <= start) {
      alert('End date must be after start date')
      return
    }

    setSubmitting(true)
    try {
      await createChallenge({
        creatorId: user.userId,
        clubId: clubId || undefined, // Include clubId if provided
        title: title.trim(),
        description: description.trim(),
        type,
        goal: goal.trim() || undefined,
        startDate: start,
        endDate: end,
      })

      alert(`Challenge created successfully${clubId ? ' for ' + clubName : ''}!`)
      onClose()
    } catch (error) {
      console.error('Error creating challenge:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create challenge'
      alert(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-[#161b22] rounded-md max-w-2xl w-full border border-[#30363d]">
        {/* Header */}
        <div className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#c9d1d9]">
              {clubId ? `Create Challenge for ${clubName}` : 'Create Challenge'}
            </h2>
            {clubId && (
              <p className="text-sm text-[#8b949e] mt-1">
                This challenge will be visible to all club members
              </p>
            )}
          </div>
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
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Challenge Title <span className="text-[#f85149]">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
              placeholder="e.g., October Reading Challenge"
            />
            <p className="text-xs text-[#8b949e] mt-1">{title.length}/100 characters</p>
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
              placeholder="Describe what participants need to do..."
            />
            <p className="text-xs text-[#8b949e] mt-1">{description.length}/500 characters</p>
          </div>

          {/* Type */}
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Challenge Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] focus:border-[#58a6ff] focus:outline-none"
            >
              <option value="study">📚 Study</option>
              <option value="reading">📖 Reading</option>
              <option value="workout">💪 Workout</option>
              <option value="custom">🎯 Custom</option>
            </select>
          </div>

          {/* Goal */}
          <div>
            <label htmlFor="goal" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Goal (Optional)
            </label>
            <input
              id="goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={100}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
              placeholder="e.g., Read 5 books, Study 100 hours"
            />
            <p className="text-xs text-[#8b949e] mt-1">
              Optional measurable goal for participants
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-[#c9d1d9] mb-2">
                Start Date <span className="text-[#f85149]">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] focus:border-[#58a6ff] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-[#c9d1d9] mb-2">
                End Date <span className="text-[#f85149]">*</span>
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] focus:border-[#58a6ff] focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#30363d]">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2 px-4 rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Challenge'}
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
